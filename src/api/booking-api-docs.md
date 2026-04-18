# FlipOn Booking API Documentation

## Base URL
```
http://localhost:3000/api/bookings
```

## Authentication
All endpoints require authentication token in Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### 1. Create Booking
**POST** `/api/bookings`

**Request Body:**
```json
{
  "service_id": "uuid",
  "booking_type": "consumer",
  "customer_name": "John Doe",
  "customer_mobile": "9876543210",
  "customer_email": "john@example.com",
  "service_address": {
    "address": "123 Main St, City, State",
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "government_documents": {
    "passport_sized_photo": "filename.jpg",
    "identity_proof": "filename.jpg",
    "address_proof": "filename.jpg"
  },
  "preferred_date": "2024-01-15",
  "preferred_time": "10:00 AM",
  "notes": "Special instructions"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "customer_id": "customer-uuid",
    "service_id": "service-uuid",
    "status": "pending",
    "price_quoted": 275.00,
    "final_price": 275.00,
    "created_at": "2024-01-10T10:00:00Z"
  },
  "message": "Booking created successfully"
}
```

### 2. Get My Bookings
**GET** `/api/bookings/my-bookings`

**Query Parameters:**
- `status` (optional): Filter by status (pending, assigned, accepted, documents_collected, submitted, completed, cancelled)
- `booking_type` (optional): Filter by type (consumer, industrial)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "booking-uuid",
      "status": "pending",
      "customer_name": "John Doe",
      "customer_mobile": "9876543210",
      "service_address": {...},
      "price_quoted": 275.00,
      "final_price": 275.00,
      "created_at": "2024-01-10T10:00:00Z",
      "service": {
        "id": "service-uuid",
        "name": "Aadhaar Address Update",
        "category": "Aadhaar Services",
        "user_cost": 275.00,
        "govt_fees": 75.00,
        "partner_earning": 100.00,
        "total_expense": 175.00,
        "expected_timeline": "4 weeks",
        "company_margin": 100.00,
        "remarks": "Update address in Aadhaar"
      },
      "agent": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

### 3. Get Booking Details
**GET** `/api/bookings/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "status": "accepted",
    "customer_name": "John Doe",
    "customer_mobile": "9876543210",
    "customer_email": "john@example.com",
    "service_address": {
      "address": "123 Main St, City, State",
      "latitude": 28.6139,
      "longitude": 77.2090
    },
    "government_documents": {
      "passport_sized_photo": {
        "filename": "photo-123456789.jpg",
        "originalName": "my-photo.jpg",
        "path": "uploads/documents/photo-123456789.jpg",
        "uploadedAt": "2024-01-10T10:30:00Z"
      }
    },
    "price_quoted": 275.00,
    "final_price": 275.00,
    "payment_status": "pending",
    "completion_otp": null,
    "created_at": "2024-01-10T10:00:00Z",
    "accepted_at": "2024-01-10T11:00:00Z",
    "service": {
      "id": "service-uuid",
      "name": "Aadhaar Address Update",
      "category": "Aadhaar Services",
      "user_cost": 275.00,
      "govt_fees": 75.00,
      "partner_earning": 100.00,
      "total_expense": 175.00,
      "expected_timeline": "4 weeks",
      "company_margin": 100.00,
      "remarks": "Update address in Aadhaar",
      "description": "Update address in existing Aadhaar card"
    },
    "agent": {
      "id": "agent-uuid",
      "name": "Agent Smith",
      "mobile": "9876543211",
      "rating": 4.5,
      "total_jobs_completed": 25
    }
  }
}
```

### 4. Cancel Booking
**PUT** `/api/bookings/:id/cancel`

**Request Body:**
```json
{
  "reason": "Customer requested cancellation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "status": "cancelled",
    "cancelled_at": "2024-01-10T12:00:00Z",
    "cancellation_reason": "Customer requested cancellation"
  },
  "message": "Booking cancelled successfully"
}
```

### 5. Upload Document
**POST** `/api/bookings/:id/upload-document`

**Content-Type:** `multipart/form-data`

**Request Body:**
- `document` (file): The document file (JPEG, JPG, PNG, PDF, max 5MB)
- `documentType` (string): Type of document (passport_sized_photo, identity_proof, address_proof, etc.)
  - Note: You can also use `document_type` parameter name

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "documentType": "passport_sized_photo",
    "filename": "photo-123456789.jpg",
    "originalName": "my-photo.jpg"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Document type is required"
}
```

### 6. Verify Completion
**POST** `/api/bookings/:id/verify-completion`

**Request Body:**
```json
{
  "otp": "123456",
  "rating": 5,
  "feedback": "Excellent service!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "completion_verified_at": "2024-01-15T14:00:00Z",
    "customer_rating": 5,
    "customer_feedback": "Excellent service!"
  },
  "message": "Service completion verified successfully"
}
```

## Status Flow
1. `pending` - Booking created, waiting for agent assignment
2. `assigned` - Agent assigned to booking
3. `accepted` - Agent accepted the booking
4. `documents_collected` - Agent collected documents
5. `submitted` - Documents submitted to government
6. `completed` - Service completed, waiting for customer verification
7. `cancelled` - Booking cancelled

## Status Badge Colors
- pending: #FFC107 (Yellow)
- assigned: #2196F3 (Blue)
- accepted: #FF9800 (Orange)
- documents_collected: #9C27B0 (Purple)
- submitted: #00BCD4 (Cyan)
- completed: #4CAF50 (Green)
- cancelled: #F44336 (Red)

## Error Responses
```json
{
  "success": false,
  "message": "Error description"
}
```

## Common Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error
