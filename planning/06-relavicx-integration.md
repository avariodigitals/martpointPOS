# MartPoint Website — RelaviCX Integration Plan

## Overview
All lead forms (Book Demo, Request Quote, Contact) submit to a Next.js API Route (`/api/leads`), which then forwards the data to RelaviCX CRM via their REST API.

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `RELAVICX_API_KEY` | API authentication key | Yes |
| `RELAVICX_API_URL` | RelaviCX API base URL | Yes |
| `RELAVICX_RETAIL_PIPELINE_ID` | Pipeline for Retail leads | Yes |
| `RELAVICX_ERP_PIPELINE_ID` | Pipeline for ERP leads | Yes |
| `RELAVICX_GENERAL_PIPELINE_ID` | Pipeline for undecided leads | Yes |

## Lead Routing Logic

```
productInterest === "retail"   → RELAVICX_RETAIL_PIPELINE_ID
productInterest === "erp"      → RELAVICX_ERP_PIPELINE_ID
productInterest === "not-sure" → RELAVICX_GENERAL_PIPELINE_ID
```

## Field Mapping

| MartPoint Form Field | RelaviCX Field | Type | Notes |
|----------------------|----------------|------|-------|
| fullName | name | string | Combined first + last name |
| businessName | company | string | Business/company name |
| email | email | string | Primary contact email |
| phone | phone | string | Nigerian mobile format |
| businessType | custom.business_type | string | Dropdown value |
| productInterest | custom.product_interest | string | retail / erp / not-sure |
| branches | custom.branch_count | string | 1, 2-3, 4-6, etc. |
| staffSize | custom.staff_size | string | 1-5, 6-15, etc. |
| challenge | custom.current_challenge | string | Free text (optional) |
| message | notes | string | Free text (optional) |
| source | source | string | demo / quote / contact |

## API Route: `/api/leads`

### Request
```json
{
  "fullName": "John Doe",
  "businessName": "Doe Stores Ltd",
  "email": "john@doestores.com",
  "phone": "+234 803 123 4567",
  "businessType": "Supermarket",
  "productInterest": "retail",
  "branches": "3",
  "staffSize": "6-15",
  "challenge": "Stock management",
  "message": "Interested in a demo",
  "source": "demo"
}
```

### RelaviCX POST
```
POST ${RELAVICX_API_URL}/leads
Authorization: Bearer ${RELAVICX_API_KEY}
Content-Type: application/json

{
  "name": "John Doe",
  "company": "Doe Stores Ltd",
  "email": "john@doestores.com",
  "phone": "+234 803 123 4567",
  "pipeline_id": "${RELAVICX_RETAIL_PIPELINE_ID}",
  "source": "demo",
  "custom": {
    "business_type": "Supermarket",
    "product_interest": "retail",
    "branch_count": "3",
    "staff_size": "6-15",
    "current_challenge": "Stock management"
  },
  "notes": "Interested in a demo"
}
```

## Implementation Status
- [x] Client form with Zod validation
- [x] API route scaffold with field extraction and pipeline routing
- [ ] RelaviCX API integration (pending credentials)
- [ ] Environment variable configuration
- [ ] Production endpoint testing

## Next Steps
1. Obtain RelaviCX API credentials
2. Add environment variables to `.env.local`
3. Uncomment and test the RelaviCX fetch call in `/api/leads`
4. Verify lead creation in RelaviCX dashboard
5. Set up webhook notifications if needed
