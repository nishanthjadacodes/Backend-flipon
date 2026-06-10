import { Booking, User, Service, Document, Referral, Notification, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { generateOTP } from '../utils/otpGenerator.js';
import { getFileUrl, getStoredFileValue } from '../middleware/upload.js';
import { getIoInstance } from '../config/socket.js';
import {
  sendBookingNotification,
  sendPaymentNotification,
  sendDocumentNotification,
  sendJobCompletionNotification,
  sendCompletionOtpRequestNotification,
} from '../services/notificationService.js';
import { sendOtpSms } from '../services/smsService.js';
import { creditWallet } from './walletController.js';

// Refer & Earn policy enforcement — fires when a referee completes their
// first paid service. Idempotent: only triggers once per Referral.
//
// Per the policy:
//   1. Referrer gets ₹20 credits (not ₹50 — earlier code was wrong).
//   2. Booking value must be ≥ ₹99 for the reward to count.
//   3. After crediting, check if referrer has hit a milestone tier
//      (5/10/25 successful referrals) and credit the bonus + flag
//      Priority User on Gold.
const MILESTONE_TIERS = [
  { count: 5,  bonus: 50,  label: 'Bronze Super Referrer',  status: null },
  { count: 10, bonus: 150, label: 'Silver Super Referrer',  status: null },
  { count: 25, bonus: 500, label: 'Gold Star Super Referrer', status: 'priority_user' },
];

// Internal — credits reward + milestone for one specific Referral row.
// Caller decides whether the referee is a customer or an agent based on
// what kind of booking just completed; this function only cares that we
// just confirmed the referee's first paid service.
const creditReferralReward = async ({ referral, bookingId, bookingValue, refereeRole }) => {
  const meetsMinimum = bookingValue >= 99;
  const now = new Date();
  await referral.update({
    status: 'completed',
    first_service_completed_at: now,
    credited_at: meetsMinimum ? now : null,
  });

  if (!meetsMinimum) {
    console.log(
      `[referral] booking ${bookingId} value ₹${bookingValue} < ₹99 — referral marked complete but no reward credited`,
    );
    return;
  }

  await creditWallet({
    userId: referral.referrer_id,
    amount: 20,
    source: 'referral_reward',
    description:
      refereeRole === 'agent'
        ? 'Downline rep completed first task'
        : 'Friend completed first service',
    bookingId,
  });

  const successfulCount = await Referral.count({
    where: { referrer_id: referral.referrer_id, status: 'completed' },
  });
  const tier = MILESTONE_TIERS.find((t) => t.count === successfulCount);
  if (tier) {
    await creditWallet({
      userId: referral.referrer_id,
      amount: tier.bonus,
      source: 'referral_milestone',
      description: `${tier.label} achieved — ${tier.count} successful referrals`,
      bookingId,
    });
    if (tier.status === 'priority_user') {
      try {
        await User.update(
          { is_priority_user: true },
          { where: { id: referral.referrer_id } },
        );
      } catch (priErr) {
        console.error('[referral] failed to set priority_user flag:', priErr?.message);
      }
    }
    console.log(
      `[referral] milestone ${tier.label} — credited ₹${tier.bonus} to user ${referral.referrer_id}`,
    );
  }
};

// Fires when a booking transitions to 'completed'. Handles BOTH directions
// of the Refer & Earn policy:
//
//   1. Customer-to-customer: someone signs up using a customer's referral
//      code and completes their first paid booking → original referrer
//      gets ₹20 (matched on Referral.referee_id = booking.customer_id).
//
//   2. Agent-to-agent: a rep referred via another rep's code completes
//      their first task as the agent → original referrer gets ₹20
//      (matched on Referral.referee_id = booking.agent_id).
//
// Idempotency comes solely from Referral.status='pending' — once the
// reward has fired we flip the row to 'completed' and a re-fire would
// no-op because the WHERE clause won't match. We DON'T also gate on
// "this is the user's first completed booking" any more, because that
// silently swallows rewards for users who had earlier completions
// before the trigger started looking at agent_id.
const triggerReferralRewardIfFirstBooking = async (booking) => {
  try {
    const bookingValue = parseFloat(booking.price_quoted || 0);

    // Direction 1 — customer-side first service.
    if (booking.customer_id) {
      const customerReferral = await Referral.findOne({
        where: { referee_id: booking.customer_id, status: 'pending' },
      });
      if (customerReferral) {
        await creditReferralReward({
          referral: customerReferral,
          bookingId: booking.id,
          bookingValue,
          refereeRole: 'customer',
        });
      }
    }

    // Direction 2 — agent-side first task.
    if (booking.agent_id) {
      const agentReferral = await Referral.findOne({
        where: { referee_id: booking.agent_id, status: 'pending' },
      });
      if (agentReferral) {
        await creditReferralReward({
          referral: agentReferral,
          bookingId: booking.id,
          bookingValue,
          refereeRole: 'agent',
        });
      }
    }
  } catch (e) {
    console.error('Referral reward trigger failed:', e);
  }
};

// Create new booking
const createBooking = async (req, res) => {
  try {
    console.log('=== BOOKING CREATION START ===');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user);
    
    // Handle alternative field names with more flexible mapping - MUST BE DEFINED FIRST
    const finalServiceId = req.body.service_id || req.body.serviceId || req.body.service || null;

    // Normalize booking_type — only 'consumer' and 'industrial' are valid; everything else maps to 'consumer'
    const rawBookingType = req.body.booking_type || req.body.bookingType || 'consumer';
    const finalBookingType = ['consumer', 'industrial'].includes(rawBookingType) ? rawBookingType : 'consumer';

    // customer_name = the booking account holder (who paid).
    // applicant_name = the person the service is FOR (may be a family
    // member). Keep them separate so admin + agent can see both.
    // We intentionally do NOT fall back from customer_name to applicant_name
    // here anymore (that would conflate the two identities); we only fall
    // back to the logged-in user's profile when no customer name was sent.
    const finalCustomerName = req.body.customer_name || req.body.name || req.body.full_name || req.body.customer || req.user?.name || req.user?.mobile || null;
    const finalApplicantName = (req.body.applicant_name || '').toString().trim() || null;
    const finalMobile = req.body.customer_mobile || req.body.mobile || req.body.mobile_number || req.body.phone || null;
    const finalAddress = req.body.service_address || req.body.address || req.body.customer_address || req.body.location || null;
    
    // Resolve date — frontend sends 'selected_date', standard field is 'preferred_date'
    const rawDate = req.body.preferred_date || req.body.selected_date || null;
    const preferred_date = rawDate ? rawDate.split('T')[0] : null; // DATEONLY: strip time part

    // Resolve time — frontend sends a selected_time_slot object like { startTime: '08:00', display: '...' }
    const rawTimeSlot = req.body.selected_time_slot;
    const preferred_time = req.body.preferred_time ||
      (rawTimeSlot?.display || (rawTimeSlot?.startTime ? `${rawTimeSlot.startTime} - ${rawTimeSlot.endTime}` : null)) ||
      null;

    // Extract remaining fields
    const {
      customer_email,
      government_documents,
      home_service_details,
      industrial_service_details,
      notes,
      priority = 'medium'
    } = req.body;
    
    console.log('Enhanced field mapping:', {
      receivedFields: Object.keys(req.body),
      finalFields: {
        finalServiceId,
        finalBookingType,
        finalCustomerName,
        finalMobile,
        finalAddress
      },
      otherFields: {
        customer_email,
        preferred_date,
        preferred_time,
        government_documents,
        home_service_details,
        industrial_service_details,
        notes,
        priority
      }
    });

    
    if (!finalServiceId || !finalBookingType || !finalCustomerName || !finalMobile || !finalAddress) {
      console.log('Enhanced validation failed:', {
        finalServiceId: !!finalServiceId,
        finalBookingType: !!finalBookingType,
        finalCustomerName: !!finalCustomerName,
        finalMobile: !!finalMobile,
        finalAddress: !!finalAddress,
        receivedFields: Object.keys(req.body)
      });
      return res.status(400).json({
        success: false,
        message: 'Service ID, booking type, customer name, mobile, and address are required',
        debug: {
          receivedFields: Object.keys(req.body),
          finalFields: {
            finalServiceId: !!finalServiceId,
            finalBookingType: !!finalBookingType,
            finalCustomerName: !!finalCustomerName,
            finalMobile: !!finalMobile,
            finalAddress: !!finalAddress
          }
        }
      });
    }

    // Validate booking type specific fields
    if (finalBookingType === 'industrial' && !industrial_service_details) {
      return res.status(400).json({
        success: false,
        message: 'Industrial service details are required for industrial services'
      });
    }

    // Get service details
    const service = await Service.findByPk(finalServiceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
        debug: {
          serviceId: finalServiceId,
          originalServiceId: req.body.service_id || req.body.serviceId || req.body.service
        }
      });
    }

    // Sequential customer-facing booking number, starting at 1000 so
    // the user-facing IDs always look like real four-digit order
    // numbers (#1000, #1001, …) rather than the early #0001 / #0083
    // we shipped initially. If the table already has booking_numbers
    // beyond 1000, we keep incrementing from the max. Best-effort —
    // if the SELECT or unique-constraint hits a collision we fall
    // through to NULL and the app falls back to its UUID-derived
    // display.
    const BOOKING_NUMBER_FLOOR = 1000;
    let bookingNumber = null;
    try {
      const [rows] = await sequelize.query(
        `SELECT GREATEST(COALESCE(MAX(booking_number), 0) + 1, ${BOOKING_NUMBER_FLOOR}) AS next FROM bookings`,
      );
      bookingNumber = rows?.[0]?.next || null;
    } catch (e) {
      console.error('[booking] could not compute next booking_number:', e?.message);
    }

    // Refer & Earn — ₹20 referee discount on the customer's FIRST booking
    // when they signed up with a referral code. We deduct it from the
    // service price and store the discount amount on the booking row so
    // the receipt can show "Service ₹X, Referral discount −₹20, Net ₹Y".
    // The discount only applies if there's a pending Referral row AND
    // this is the customer's first booking.
    const baseUserCost = parseFloat(service.user_cost || 0);
    let priceQuoted = baseUserCost;
    let referralDiscount = 0;
    try {
      const pendingReferral = await Referral.findOne({
        where: { referee_id: req.user.id, status: 'pending' },
      });
      if (pendingReferral) {
        const existingBookingCount = await Booking.count({
          where: { customer_id: req.user.id },
        });
        if (existingBookingCount === 0) {
          // Cap the discount at the booking value so we never end up with
          // a negative price (e.g. service costs ₹15 — discount drops to ₹15).
          referralDiscount = Math.min(
            parseFloat(pendingReferral.referee_discount || 20),
            baseUserCost,
          );
          priceQuoted = Math.max(0, baseUserCost - referralDiscount);
          console.log(
            `[referral] applied ₹${referralDiscount} discount on first booking for referee ${req.user.id}`,
          );
        }
      }
    } catch (refErr) {
      console.error('[referral] discount lookup failed (proceeding at full price):', refErr?.message);
    }

    // Duplicate-booking guard — narrowed per product spec to JUST:
    // same customer + same service + same applicant name (case-
    // insensitive, trimmed). Everything else (date, time, address,
    // mobile, amount, payment method) is allowed to differ — those
    // aren't enough on their own to flag a duplicate.
    //
    // Examples:
    //   • Customer books "Aadhaar Address Update" for "Ramesh" on
    //     Monday → tries to book it again for "Ramesh" on Tuesday
    //     (different date/address) → BLOCKED. The applicant already
    //     has an active job for this service.
    //   • Customer books "Aadhaar Address Update" for "Ramesh" → tries
    //     to book the same service for "Sita" → ALLOWED. Different
    //     applicant.
    //   • Customer books for themselves (no applicant_name) → tries
    //     again with no applicant_name → BLOCKED. Both treat NULL as
    //     "the customer is the applicant".
    //
    // Cancelled / rejected rows are excluded so a customer who
    // cancelled can rebook freely.
    try {
      const norm = (s) => (s || '').toString().trim().toLowerCase() || null;
      const candidates = await Booking.findAll({
        where: {
          customer_id: req.user.id,
          service_id: finalServiceId,
          status: { [Op.notIn]: ['cancelled', 'rejected'] },
        },
        attributes: [
          'id', 'booking_number', 'applicant_name', 'status', 'created_at',
        ],
        order: [['created_at', 'DESC']],
        limit: 20,
      });
      const target = norm(finalApplicantName);
      // Escape hatch — if the existing booking has been STUCK in
      // 'pending' (no agent assigned, no movement) for more than 7
      // days, treat it as abandoned and let the customer rebook the
      // same service for the same applicant. Without this, a
      // genuinely stalled booking would silently block the user
      // forever. As soon as the booking progresses to assigned /
      // accepted / documents_collected / etc., this escape hatch
      // disappears so we still prevent duplicate active jobs.
      const STUCK_PENDING_DAYS = 7;
      const stuckCutoff = new Date(
        Date.now() - STUCK_PENDING_DAYS * 24 * 60 * 60 * 1000,
      );
      const isStuckPending = (b) =>
        b.status === 'pending' && new Date(b.created_at) < stuckCutoff;

      // Diagnostic — Render logs will show exactly what the guard
      // saw. Useful when "why didn't it block?" comes up: the most
      // common reason is that existing bookings have NULL
      // applicant_name (created before the column shipped), so a new
      // booking with an actual name doesn't match any candidate.
      console.log(
        `[dup-guard] customer=${req.user.id} service=${finalServiceId} ` +
        `targetApplicant=${JSON.stringify(target)} candidates=${candidates.length}`,
      );
      if (candidates.length > 0) {
        console.log(
          '[dup-guard] candidate applicants:',
          candidates.map((b) => ({
            id: String(b.id).slice(0, 8),
            applicant: b.applicant_name,
            normalised: norm(b.applicant_name),
            status: b.status,
            stuck: isStuckPending(b),
          })),
        );
      }
      const dupe = candidates.find(
        (b) => norm(b.applicant_name) === target && !isStuckPending(b),
      );
      if (dupe) {
        console.log('[dup-guard] BLOCKED — match on booking', dupe.id);
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_BOOKING',
          message: target
            ? `A booking for "${finalApplicantName}" on this service already exists. Use a different applicant name to proceed.`
            : 'You already have an active booking for this service. Use a different applicant name to book again.',
          existingBookingId: dupe.id,
          existingBookingNumber: dupe.booking_number,
        });
      }
      console.log(
        '[dup-guard] ALLOWED — no candidate matched applicant ' +
        '(or matched candidate is >7d stuck in pending)',
      );
    } catch (dupErr) {
      // Don't block the booking on a guard query failure — log and
      // proceed. The race window is small and the worst case is one
      // accidental duplicate that admin can refund.
      console.error('[booking] duplicate-guard query failed (proceeding):', dupErr?.message);
    }

    // Snapshot the rate-chart split onto this booking row so historical
    // bookings stay immune to later service-price edits AND so the
    // Finance & Accounts report can show actual margin vs gross revenue.
    // Invariant: final_price = govt_fees + partner_earning + company_margin
    // (after deducting any referral discount, which the company absorbs —
    // the partner still gets their full earning).
    const svcGovtFees = parseFloat(service.govt_fees || 0);
    const svcPartnerEarning = parseFloat(service.partner_earning || 0);
    const svcCompanyMargin = parseFloat(service.company_margin || 0);
    const snapshotCompanyMargin = Math.max(0, svcCompanyMargin - referralDiscount);

    const booking = await Booking.create({
      customer_id: req.user.id,
      service_id: finalServiceId,
      booking_type: finalBookingType,
      customer_name: finalCustomerName,
      applicant_name: finalApplicantName,
      customer_mobile: finalMobile,
      customer_email,
      service_address: finalAddress,
      preferred_date,
      preferred_time,
      government_documents,
      home_service_details,
      industrial_service_details,
      documents_required: service.required_documents,
      dynamic_fields: req.body.dynamic_fields || null,
      price_quoted: priceQuoted,
      final_price: priceQuoted,
      referral_discount: referralDiscount,
      govt_fees: svcGovtFees,
      partner_earning: svcPartnerEarning,
      company_margin: snapshotCompanyMargin,
      notes,
      priority,
      booking_number: bookingNumber,
    });

    // Link the documents the user uploaded for THIS booking session.
    // The app keeps the list of document IDs returned from each upload
    // and sends them in `document_ids: [...]` on the booking payload.
    // We only attach the ones the user explicitly sends — never sweep
    // up "all recent" loose docs (that leaked across services).
    try {
      const requestedIds = Array.isArray(req.body.document_ids)
        ? req.body.document_ids.filter(Boolean)
        : [];
      if (requestedIds.length) {
        const [linked] = await Document.update(
          { booking_id: booking.id },
          {
            where: {
              id: { [Op.in]: requestedIds },
              uploaded_by: req.user.id, // owner check — can't hijack others' docs
              booking_id: null,         // don't re-attach docs already on another booking
            },
          },
        );
        console.log(`[booking] linked ${linked}/${requestedIds.length} session docs to booking ${booking.id}`);
      }
    } catch (linkErr) {
      console.error('[booking] failed to link session docs:', linkErr?.message);
    }

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });

    // Emit WebSocket event for real-time booking creation
    const io = getIoInstance();
    if (io) {
      io.to('role_admin').emit('booking_created', {
        bookingId: booking.id,
        customerId: booking.customer_id,
        serviceId: booking.service_id,
        status: booking.status,
        createdBy: req.user.name,
        timestamp: new Date()
      });

      io.to(`user_${booking.customer_id}`).emit('booking_confirmed', {
        bookingId: booking.id,
        serviceId: booking.service_id,
        status: 'pending',
        message: 'Your booking has been created successfully',
        timestamp: new Date()
      });
    }

    // Push notifications — fire-and-forget so we don't delay the response.
    // Sends a phone push to:
    //   1. All active admins (any admin role)  → Order Management lead
    //   2. All available representatives        → broadcast new-job alert
    // The dashboard's 20-s polling separately ensures the new row shows
    // even if push delivery is slow or the admin's app is asleep.
    (async () => {
      try {
        const hydrated = await Booking.findByPk(booking.id, {
          include: [
            { model: Service, as: 'service', attributes: ['id', 'name'] },
            { model: User, as: 'customer', attributes: ['id', 'name', 'mobile'] },
          ],
        });
        const serviceName = hydrated?.service?.name || 'Service';
        const customerName = hydrated?.customer?.name || 'Customer';

        // 1. Admins
        const ADMIN_ROLES = [
          'super_admin', 'operations_manager', 'b2b_admin',
          'finance_admin', 'customer_support',
        ];
        const admins = await User.findAll({
          where: { role: { [Op.in]: ADMIN_ROLES }, is_active: true },
          attributes: ['id'],
        });
        await Promise.all(
          admins.map((a) =>
            sendBookingNotification(a.id, booking.id, 'pending',
              `📥 New booking — ${serviceName} for ${customerName}. Assign a representative.`,
            ).catch(() => {})
          ),
        );

        // Drop a row into each admin's in-app inbox too, so the banner
        // pops the next time they open the dashboard. Independent of
        // the push above (push may be throttled, in-app inbox is the
        // reliable surface).
        await Notification.notifyMany(
          admins.map((a) => a.id),
          {
            type: 'booking.created',
            title: 'New Booking Received',
            body: `${customerName} requested ${serviceName}. Tap to assign a representative.`,
            deep_link: { route: 'orders', bookingId: booking.id },
            metadata: { booking_id: booking.id, service_id: booking.service_id },
          },
        );

        // 2. Available reps (active + KYC-verified). They get a heads-up so
        //    they can be ready when the admin assigns the job.
        const reps = await User.findAll({
          where: {
            role: 'agent',
            is_active: true,
            is_kyc_verified: true,
          },
          attributes: ['id'],
          limit: 25,
        });
        await Promise.all(
          reps.map((r) =>
            sendBookingNotification(r.id, booking.id, 'pending',
              `📋 New job available — ${serviceName}. Admin will assign shortly.`,
            ).catch(() => {})
          ),
        );

        // Drop an in-app inbox row for every rep too — same reliability
        // reason as the admin fan-out above. The push may be throttled
        // or the device token missing; the inbox banner is the
        // dependable surface that tells the rep a job is waiting to be
        // accepted. Without this, reps only ever got a transient push.
        await Notification.notifyMany(
          reps.map((r) => r.id),
          {
            type: 'booking.created',
            title: 'New Job Available',
            body: `${serviceName} for ${customerName}. Open Tasks to accept.`,
            deep_link: { route: 'AgentTabs', params: { screen: 'Tasks' } },
            metadata: { booking_id: booking.id, service_id: booking.service_id },
          },
        );
      } catch (notifyErr) {
        console.warn('[booking] post-create notify failed:', notifyErr?.message);
      }
    })();
  } catch (error) {
    console.error('=== BOOKING CREATION ERROR ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      sql: error.sql,
      parameters: error.parameters
    });
    console.error('Request data that failed:', {
      service_id: req.body.service_id || req.body.serviceId || req.body.service,
      booking_type: req.body.booking_type || req.body.bookingType,
      customer_name: req.body.customer_name || req.body.name || req.body.full_name || req.body.customer,
      customer_mobile: req.body.customer_mobile || req.body.mobile || req.body.mobile_number || req.body.phone,
      customer_email: req.body.customer_email,
      service_address: req.body.service_address || req.body.address || req.body.customer_address || req.body.location,
      address: req.body.address,
      preferred_date: req.body.preferred_date,
      preferred_time: req.body.preferred_time,
      government_documents: req.body.government_documents,
      home_service_details: req.body.home_service_details,
      industrial_service_details: req.body.industrial_service_details,
      notes: req.body.notes,
      priority: req.body.priority,
      user_id: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Booking creation failed'
    });
  }
};

// Get customer bookings
const getCustomerBookings = async (req, res) => {
  try {
    const { status, booking_type, page = 1, limit = 10 } = req.query;
    
    const whereClause = { customer_id: req.user.id };
    
    if (status) whereClause.status = status;
    if (booking_type) whereClause.booking_type = booking_type;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks']
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'mobile', 'rating']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: bookings.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.count,
        pages: Math.ceil(bookings.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching customer bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks', 'description']
        },
        {
          model: User,
          as: 'agent',
          // current_lat/lng let the customer's Tracking screen render a
          // real MapView with the rep's live position. The rep app pings
          // these columns every 60s via `pingAgentLocation` while online.
          attributes: ['id', 'name', 'mobile', 'rating', 'total_jobs_completed',
                       'current_lat', 'current_lng']
        },
        {
          model: User,
          as: 'customer',
          // Include the customer's last-known coords so the agent's
          // task-detail screen can compute a real distance from the
          // rep's current GPS without relying on Android's flaky
          // Location.geocodeAsync (which returns empty on devices
          // without Google Mobile Services and shows "Address
          // unresolved" to the rep).
          attributes: ['id', 'name', 'mobile', 'current_lat', 'current_lng']
        },
        {
          // Documents attached to this booking — surfaced in the customer
          // app's Tracking screen. Without this include, booking.documents
          // is undefined and the screen shows "No documents attached" even
          // when the user has uploaded several.
          model: Document,
          as: 'documents',
          attributes: ['id', 'document_type', 'file_name', 'file_url', 'mime_type', 'is_verified', 'uploaded_at', 'category'],
          required: false,
        },
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to view this booking. Customer + assigned
    // representative + any admin role have read access.
    const ADMIN_ROLES = new Set([
      'super_admin',
      'operations_manager',
      'customer_support',
      'b2b_admin',
      'finance_admin',
    ]);
    if (
      booking.customer_id !== req.user.id &&
      booking.agent_id !== req.user.id &&
      !ADMIN_ROLES.has(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Hydrate document file_url with the absolute upload URL so the customer
    // app's preview modal can render the image directly. Without this, the
    // raw stored filename ("abc123.jpg") arrives at <Image source={{uri}}>
    // and the modal renders a black screen. We pass `req` so getFileUrl can
    // derive the host from the request if no env var is configured.
    const responseBody = booking.toJSON();
    if (Array.isArray(responseBody.documents)) {
      responseBody.documents = responseBody.documents.map((d) => ({
        ...d,
        file_url: d.file_url ? getFileUrl(d.file_url, d.category, req) : d.file_url,
      }));
    }

    // Strip the completion OTP from the response unless the caller is the
    // customer themselves. The rep MUST NOT see it — the whole point of
    // the OTP gate is that the customer shares it verbally to verify the
    // rep is actually at the job. Admins don't need it via this endpoint.
    if (booking.customer_id !== req.user.id) {
      delete responseBody.completion_otp;
      delete responseBody.completion_otp_generated_at;
    }

    res.json({
      success: true,
      data: responseBody,
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details'
    });
  }
};

// Agent accept/reject booking
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'accept' or 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either accept or reject'
      });
    }

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Booking can only be accepted or rejected when in assigned status'
      });
    }

    if (booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update bookings assigned to you'
      });
    }

    const updates = {
      status: action === 'accept' ? 'accepted' : 'cancelled',
      agent_notes: notes,
      accepted_at: action === 'accept' ? new Date() : null,
      cancelled_at: action === 'reject' ? new Date() : null,
      cancellation_reason: action === 'reject' ? notes : null
    };

    await booking.update(updates);

    res.json({
      success: true,
      data: booking,
      message: `Booking ${action}ed successfully`
    });

    // Emit WebSocket event for real-time booking status updates
    const io = getIoInstance();
    if (io) {
      io.to(`booking_${id}`).emit('booking_status_changed', {
        bookingId: id,
        status: updates.status,
        updatedBy: req.user.name,
        timestamp: new Date(),
        action: action
      });
      
      // Notify customer about status change
      io.to(`user_${booking.customer_id}`).emit('booking_update_notification', {
        bookingId: id,
        status: updates.status,
        message: `Your booking has been ${action}ed`,
        timestamp: new Date()
      });

      // Send push notification for booking status change
      await sendBookingNotification(booking.customer_id, id, updates.status, `Your booking has been ${action}ed`);
    }
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status'
    });
  }
};

// Update job status (agent)
const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, documents_collected, submission_details, notes } = req.body;

    // The agent app's status flow has more steps than the backend ENUM. Map
    // each agent-app status to (a) the DB status to write (or null = no
    // status change, just record progress), and (b) which timestamp column
    // to stamp.
    const statusMap = {
      started:             { dbStatus: null,                  stamp: null },
      reached_location:    { dbStatus: null,                  stamp: null },
      in_progress:         { dbStatus: null,                  stamp: null },
      documents_collected: { dbStatus: 'documents_collected', stamp: 'documents_collected_at' },
      work_completed:      { dbStatus: 'submitted',           stamp: 'submitted_at' },
      submitted:           { dbStatus: 'submitted',           stamp: 'submitted_at' },
      completed:           { dbStatus: 'completed',           stamp: null },
    };

    const mapping = statusMap[status];
    if (!mapping) {
      return res.status(400).json({
        success: false,
        message: `Invalid status "${status}". Allowed: ${Object.keys(statusMap).join(', ')}`,
      });
    }

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update bookings assigned to you'
      });
    }

    const updates = {};
    if (mapping.dbStatus) updates.status = mapping.dbStatus;
    if (notes) updates.agent_notes = notes;

    if (status === 'documents_collected') {
      updates.documents_collected = documents_collected;
      updates.documents_collected_at = new Date();
    }

    // Stamp `completed_at` whenever this update flips the booking to
    // complete — even if it had a prior `completed_at` from an earlier
    // run. This matches /verify-completion's behaviour (which always
    // overwrites completed_at). Without overwriting, repeated test
    // runs of the same booking keep the FIRST completion's date, and
    // today's earnings tile stays ₹0 because the system thinks all
    // those bookings completed long ago. Production is unaffected:
    // a real booking completes once, completed_at = first stamp.
    if (mapping.dbStatus === 'completed') {
      updates.completed_at = new Date();
    }

    // When the rep finishes the work (work_completed/submitted/completed),
    // generate the completion OTP. The customer reads this OTP off their
    // app/SMS and tells it to the rep, who enters it to close the booking.
    // We generate it once — re-using the existing OTP if the rep retries.
    if (
      status === 'submitted' ||
      status === 'work_completed' ||
      status === 'completed'
    ) {
      if (submission_details) updates.submission_details = submission_details;
      updates.submitted_at = new Date();
      if (!booking.completion_otp) {
        // 6-digit by deliberate override: completion OTPs aren't SMS'd,
        // they're read off the customer's screen and spoken to the rep, so
        // they're not bound to the login Fast2SMS template length. Existing
        // bookings already in the DB have 6-digit codes — keep parity.
        const completionOTP = generateOTP(6);
        updates.completion_otp = completionOTP;
        updates.completion_otp_generated_at = new Date();
        console.log(`Completion OTP for booking ${id}: ${completionOTP}`);
      }
    }

    // Append a progress note for sub-steps that don't change DB status (so
    // admins still see the timeline in agent_notes).
    if (!mapping.dbStatus) {
      const stampLine = `[${new Date().toISOString()}] agent: ${status}`;
      updates.agent_notes = booking.agent_notes
        ? `${booking.agent_notes}\n${stampLine}`
        : stampLine;
    }

    await booking.update(updates);

    // If this update flips the booking to 'completed', fire the
    // double-sided referral reward trigger here too AND auto-verify any
    // booking documents (so the customer's UI stops showing "In Review"
    // after the work is finished). /verify-completion already does both;
    // mirror them here for the silent /job-status path.
    if (mapping.dbStatus === 'completed') {
      const fresh = await Booking.findByPk(id);
      if (fresh) triggerReferralRewardIfFirstBooking(fresh);
      try {
        await Document.update(
          { is_verified: true, verified_at: new Date() },
          { where: { booking_id: id, is_verified: false } },
        );
      } catch (docErr) {
        console.error('[updateJobStatus] auto-verify docs failed:', docErr?.message);
      }
    }

    // Never expose the completion OTP to the rep — the OTP only travels
    // through the customer's phone. The rep asks the customer for it
    // verbally and submits via /verify-completion. Strip from the
    // response so a curious rep poking at the network tab can't lift it.
    const repSafeBooking = booking.toJSON();
    delete repSafeBooking.completion_otp;
    delete repSafeBooking.completion_otp_generated_at;
    res.json({
      success: true,
      data: repSafeBooking,
      message: `Job status updated to ${status} successfully`,
    });

    // Emit WebSocket event for real-time job status updates
    const io = getIoInstance();
    if (io) {
      io.to(`booking_${id}`).emit('job_status_changed', {
        bookingId: id,
        status: status,
        updatedBy: req.user.name,
        timestamp: new Date()
      });
      
      // Notify customer about job status change
      io.to(`user_${booking.customer_id}`).emit('job_update_notification', {
        bookingId: id,
        status: status,
        message: `Job status updated to ${status}`,
        timestamp: new Date()
      });

      // Push the completion OTP to the customer the moment it's generated
      // (rep just hit "Work Completed" / "Submitted"). The customer needs
      // to see this BEFORE the rep can verify — they read it off this
      // notification, the SMS, or BookingDetails and tell the rep verbally.
      const otpForCustomer = updates.completion_otp || booking.completion_otp;
      if ((status === 'work_completed' || status === 'submitted') && otpForCustomer) {
        await sendCompletionOtpRequestNotification(
          booking.customer_id,
          id,
          otpForCustomer,
        );

        // Also send a real SMS via Fast2SMS DLT — same template as login
        // OTPs ("Your OTP for FliponeX is {OTP}"). The customer recognises
        // the purpose from context (rep is standing in front of them
        // asking). Fire-and-forget: SMS failure must not break the rep's
        // status update, so we don't await its success/failure into the
        // response. Only attempt when we have a usable customer mobile.
        try {
          const customer = await User.findByPk(booking.customer_id, {
            attributes: ['mobile'],
          });
          const customerMobile = customer?.mobile;
          if (customerMobile) {
            const smsRes = await sendOtpSms({
              otpCode: String(otpForCustomer),
              phone: String(customerMobile).replace(/^\+?91/, ''),
            });
            if (!smsRes.success) {
              console.log(
                `[completion-otp] SMS send failed for booking ${id}: ${smsRes.error}`,
              );
            }
          }
        } catch (smsErr) {
          console.log(
            `[completion-otp] SMS send threw for booking ${id}:`,
            smsErr?.message,
          );
        }
      }

      // Send document upload notifications if documents are collected
      if (status === 'documents_collected') {
        await sendDocumentNotification(booking.customer_id, 'documents_collected', 'All required documents have been collected');
      }

      // Send submission notification if job is submitted
      if (status === 'submitted') {
        await sendDocumentNotification(booking.customer_id, 'job_submitted', 'Your job has been submitted to the relevant authorities');
      }

      // Final "service completed" notice — fires after the rep has
      // verified the OTP and the booking has actually transitioned to
      // 'completed'. No OTP payload here; it's already been consumed.
      if (status === 'completed') {
        await sendJobCompletionNotification(booking.customer_id, id);
      }
    }
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status'
    });
  }
};

// Verify completion OTP
const verifyCompletionOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp, rating, feedback } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Either the customer (entering the OTP themselves) or the assigned
    // rep (entering the OTP the customer just read off their phone) can
    // close the booking. Backend trust: the OTP itself is the secret.
    if (
      booking.customer_id !== req.user.id &&
      booking.agent_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only the customer or the assigned representative can verify completion'
      });
    }

    // Once the rep has marked the work as done (status='submitted' or
    // 'completed'), an OTP exists and verification is allowed. Earlier
    // statuses can't verify yet.
    if (booking.status !== 'completed' && booking.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Mark the work as completed before entering the OTP'
      });
    }

    if (booking.completion_otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    const updates = {
      status: 'completed',
      completed_at: new Date(),
      completion_verified_at: new Date(),
      customer_rating: rating,
      customer_feedback: feedback,
    };

    await booking.update(updates);

    // Once the rep + customer confirm completion via OTP, the documents
    // tied to this booking are implicitly accepted. Auto-flip is_verified
    // so the customer's BookingDetails page no longer shows them as
    // "In Review" after the work is finished.
    try {
      await Document.update(
        { is_verified: true, verified_at: new Date() },
        { where: { booking_id: id, is_verified: false } },
      );
    } catch (docErr) {
      console.error('[verifyCompletion] auto-verify docs failed:', docErr?.message);
    }

    // Update agent's rating and job count
    if (booking.agent_id && rating) {
      const agent = await User.findByPk(booking.agent_id);
      if (agent) {
        await agent.update({
          rating: rating,
          total_jobs_completed: agent.total_jobs_completed + 1
        });
      }
    }

    // Spec H: trigger double-sided referral reward on first completed
    // booking. Handles BOTH the customer-side ("friend completed first
    // service") AND agent-side ("downline rep completed first task")
    // referral chains. Runs async so a wallet hiccup doesn't break the
    // OTP response.
    triggerReferralRewardIfFirstBooking(booking);

    res.json({
      success: true,
      data: booking,
      message: 'Service completion verified successfully'
    });
  } catch (error) {
    console.error('Error verifying completion OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify completion'
    });
  }
};

// Customer leaves a star rating + optional written review on a completed
// booking. Updates customer_rating / customer_feedback on the booking row
// AND rolls the rating into the agent's average. Idempotent — can be
// called again to update the rating before the booking is settled.
const submitBookingReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review, feedback } = req.body || {};

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'rating must be between 1 and 5',
      });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the booking customer can submit a review',
      });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted for completed bookings',
      });
    }

    await booking.update({
      customer_rating: numericRating,
      customer_feedback: review || feedback || null,
    });

    // Roll the new rating into the agent's running average so the rep's
    // profile / royalty quality gate reflects fresh feedback. We store a
    // simple running average across all of the agent's rated bookings.
    if (booking.agent_id) {
      const ratedBookings = await Booking.findAll({
        where: {
          agent_id: booking.agent_id,
          customer_rating: { [Op.ne]: null },
        },
        attributes: ['customer_rating'],
      });
      const sum = ratedBookings.reduce(
        (s, b) => s + Number(b.customer_rating || 0),
        0,
      );
      const avg = ratedBookings.length > 0 ? sum / ratedBookings.length : 0;
      await User.update(
        { rating: avg.toFixed(1) },
        { where: { id: booking.agent_id } },
      );
    }

    res.json({
      success: true,
      message: 'Thanks for your feedback',
      data: {
        bookingId: id,
        customer_rating: numericRating,
        customer_feedback: review || feedback || null,
      },
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review',
    });
  }
};

// Get agent bookings
const getAgentBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const whereClause = { agent_id: req.user.id };
    if (status) whereClause.status = status;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks']
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'mobile']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: bookings.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.count,
        pages: Math.ceil(bookings.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching agent bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

// Cancel booking (customer)
// Customer-facing reschedule. Per the FliponeX booking-window spec,
// the customer can move the slot only if the new request lands >=2h
// before the CURRENT scheduled time — closer than that and the rep
// may already be en-route. Inside the 2h window we 400 with a clear
// message; the customer's option then is to call/cancel.
const customerRescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferred_date, preferred_time, reason } = req.body || {};

    if (!preferred_date && !preferred_time) {
      return res.status(400).json({
        success: false,
        message: 'Provide preferred_date and/or preferred_time to reschedule',
      });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only reschedule your own bookings',
      });
    }
    if (!['pending', 'assigned', 'accepted'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule a "${booking.status}" booking. Contact support if you need help.`,
      });
    }

    const start = scheduledStartTime(booking);
    if (start) {
      const minutesUntil = (start.getTime() - Date.now()) / 60000;
      if (minutesUntil < 120) {
        return res.status(400).json({
          success: false,
          message:
            'Reschedule window has closed — the slot is less than 2 hours away. ' +
            'Cancel the booking instead, or contact support to rearrange.',
        });
      }
    }

    const updates = {};
    if (preferred_date) updates.preferred_date = preferred_date;
    if (preferred_time) updates.preferred_time = preferred_time;
    const stamp = `[reschedule ${new Date().toISOString()}] customer${reason ? `: ${reason}` : ''}`;
    updates.notes = booking.notes ? `${booking.notes}\n${stamp}` : stamp;

    await booking.update(updates);
    res.json({
      success: true,
      data: booking,
      message: 'Booking rescheduled — no charges. The representative will see the new slot.',
    });
  } catch (error) {
    console.error('customerRescheduleBooking error:', error);
    res.status(500).json({ success: false, message: 'Failed to reschedule booking' });
  }
};

// Compose the booking's scheduled "start" instant from preferred_date +
// preferred_time. Returns null if either is missing or unparseable —
// caller should treat that as "no schedule, no window enforcement".
const scheduledStartTime = (booking) => {
  if (!booking?.preferred_date) return null;
  const dateStr = String(booking.preferred_date).split('T')[0];
  const raw = String(booking.preferred_time || '').trim();
  // Try "HH:MM AM - HH:MM AM" then "HH:MM"
  let h = 0, m = 0;
  const ampm = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (ampm) {
    h = parseInt(ampm[1], 10);
    m = parseInt(ampm[2], 10);
    const mer = ampm[3];
    if (mer && mer.toUpperCase() === 'PM' && h < 12) h += 12;
    if (mer && mer.toUpperCase() === 'AM' && h === 12) h = 0;
  } else {
    return null;
  }
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
};

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      });
    }

    if (!['pending', 'assigned'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking can only be cancelled when in pending or assigned status'
      });
    }

    // Free-cancellation window — per spec, customers get free cancellation
    // up to 1 hour before the scheduled slot. Cancellations inside that
    // window are still allowed (we never strand a customer), but a flag is
    // set so admin can decide whether to apply a Visit Fee on the next
    // booking. The customer is told upfront via the response message.
    const start = scheduledStartTime(booking);
    let withinWindow = false;
    if (start) {
      const minutesUntil = (start.getTime() - Date.now()) / 60000;
      withinWindow = minutesUntil < 60; // less than 1 hour to start
    }

    await booking.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: reason || 'Customer cancelled',
      // late_cancellation: withinWindow,    // schema column TBD; flag in notes for now
      notes: withinWindow
        ? [booking.notes || '', '[late-cancel] Cancelled within 1h of scheduled start; visit fee may apply on next booking.'].filter(Boolean).join('\n')
        : booking.notes,
    });

    res.json({
      success: true,
      data: booking,
      message: withinWindow
        ? 'Booking cancelled. As you cancelled within 1 hour of the scheduled time, a small visit fee may be added to your next booking.'
        : 'Booking cancelled successfully — no charges, you were within the free-cancellation window.',
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
};

// Upload document for booking
const uploadDocument = async (req, res) => {
  try {
    const { bookingId } = req.params;
    // Handle both documentType and document_type parameters
    const { documentType, document_type } = req.body;
    const docType = documentType || document_type;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!docType) {
      return res.status(400).json({
        success: false,
        message: 'Document type is required'
      });
    }

    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload documents for your own bookings'
      });
    }

    // Update government_documents with the uploaded file. Cloudinary
    // returns a full secure URL on file.path; disk returns the basename
    // on file.filename — getStoredFileValue picks the right one.
    const storedValue = getStoredFileValue(req.file);
    const currentDocuments = booking.government_documents || {};
    currentDocuments[docType] = {
      filename: storedValue,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date()
    };

    await booking.update({
      government_documents: currentDocuments
    });

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentType: docType,
        filename: storedValue,
        originalName: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

// Accept task (agent)
// Agent confirms a task the admin has already assigned to them.
// Accept is NOT self-service anymore — admin must assign first. Gate:
//   booking.agent_id === req.user.id  AND  booking.status === 'assigned'
// Transition: assigned → accepted.
const acceptTask = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (!booking.agent_id || booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'This task is not assigned to you. Wait for the admin to assign it before accepting.',
      });
    }
    if (booking.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a booking in "${booking.status}" status (must be "assigned").`,
      });
    }

    await booking.update({
      status: 'accepted',
      accepted_at: new Date(),
    });

    // Notify the customer that their agent has confirmed.
    try {
      const io = getIoInstance();
      if (io) {
        io.to(`user_${booking.customer_id}`).emit('booking_update_notification', {
          bookingId: booking.id,
          status: 'accepted',
          message: 'Your representative has accepted the assignment',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[acceptTask] socket notify failed:', e?.message);
    }

    res.json({ success: true, message: 'Task accepted', task: booking });
  } catch (error) {
    console.error('Error accepting task:', error);
    res.status(500).json({ success: false, message: 'Failed to accept task' });
  }
};

// Agent rejects a task the admin assigned to them. Instead of cancelling
// the whole booking, it bounces back into the admin's queue so they can
// reassign to someone else.
const rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (!booking.agent_id || booking.agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'This task is not assigned to you.',
      });
    }
    if (!['assigned', 'accepted'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a booking in "${booking.status}" status.`,
      });
    }

    const previousNotes = booking.agent_notes ? `${booking.agent_notes}\n` : '';
    const rejectionNote = `[rejected ${new Date().toISOString()}] ${reason || 'no reason provided'}`;

    await booking.update({
      agent_id: null,
      status: 'pending',
      assigned_at: null,
      accepted_at: null,
      agent_notes: previousNotes + rejectionNote,
    });

    // Notify the admin role room so the assignment dashboard can surface the bounce.
    try {
      const io = getIoInstance();
      if (io) {
        io.to('role_super_admin').emit('assignment_rejected', {
          bookingId: booking.id,
          agentId: req.user.id,
          reason: reason || null,
          timestamp: new Date().toISOString(),
        });
        io.to('role_operations_manager').emit('assignment_rejected', {
          bookingId: booking.id,
          agentId: req.user.id,
          reason: reason || null,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[rejectTask] socket notify failed:', e?.message);
    }

    res.json({
      success: true,
      message: 'Task returned to admin pool for reassignment',
      task: booking,
    });
  } catch (error) {
    console.error('Error rejecting task:', error);
    res.status(500).json({ success: false, message: 'Failed to reject task' });
  }
};

// Get agent tasks (alias for getAgentBookings for React Native app)
// Returns: bookings assigned to this agent + all unassigned pending bookings (new requests)
const getAgentTasks = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    // Map AgentApp status names back to backend DB statuses. Agents no
    // longer self-pick pending work — admin assigns first. 'new' now means
    // "admin assigned it to me, awaiting my accept".
    const mapStatusToDb = (s) => {
      switch (s) {
        case 'new':         return ['assigned'];
        case 'accepted':    return ['accepted'];
        case 'in_progress': return ['documents_collected', 'submitted', 'in_progress'];
        case 'completed':   return ['completed'];
        case 'cancelled':   return ['cancelled'];
        default:            return null; // 'all' or unknown → no filter
      }
    };

    // Only show this agent's own assignments. Unassigned bookings stay in
    // the admin pool until an admin explicitly assigns them.
    const whereClause = { agent_id: req.user.id };

    // Apply status filter (if not 'all')
    const dbStatuses = status ? mapStatusToDb(status) : null;
    if (dbStatuses) {
      whereClause.status = { [Op.in]: dbStatuses };
    }

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'category', 'user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks']
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'mobile']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    // Transform data for React Native AgentApp
    // Map backend statuses → AgentApp statuses. 'assigned' = admin just
    // assigned, agent still needs to accept. 'accepted' = agent confirmed
    // and is now executing.
    const mapStatus = (s) => {
      switch (s) {
        case 'assigned':  return 'new';         // "new" in agent UI = admin-assigned awaiting accept
        case 'accepted':  return 'accepted';    // agent confirmed
        case 'documents_collected':
        case 'submitted': return 'in_progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default:          return s;
      }
    };

    const tasks = bookings.rows.map(booking => ({
      id: booking.id,
      customerName: booking.customer_name || booking.customer?.name || 'Unknown',
      customerMobile: booking.customer_mobile || booking.customer?.mobile || 'Unknown',
      serviceName: booking.service?.name || 'Unknown Service',
      serviceType: booking.service?.category || 'general',
      address: booking.service_address || 'No address provided',
      amount: booking.service?.partner_earning || 0,
      status: mapStatus(booking.status),
      createdAt: booking.created_at,
      assignedAt: booking.assigned_at,
      completedAt: booking.completed_at,
      preferredDate: booking.preferred_date,
      preferredTime: booking.preferred_time,
      distance: '2.5 km',
    }));

    res.json({
      success: true,
      tasks: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.count,
        pages: Math.ceil(bookings.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching agent tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
};

export {
  createBooking,
  getCustomerBookings,
  getBookingDetails,
  updateBookingStatus,
  updateJobStatus,
  verifyCompletionOTP,
  submitBookingReview,
  getAgentBookings,
  cancelBooking,
  customerRescheduleBooking,
  uploadDocument,
  acceptTask,
  rejectTask,
  getAgentTasks
};
