# Lead Upload — CSV Format

Bulk-import leads via the **Upload CSV** option. The file must be a `.csv`
(max 1 file, ≤ 50 MB). Header names are **case-insensitive** (the importer
lowercases and trims them), so `Company`, `company`, and ` COMPANY ` all work.

## Header row (copy this exactly)

```
Name,Company,Phone,Contact,Email,Category,Datatype,Quantity,Location,State,Address,Requirements,Remarks,Call Status,Inquiry Date,Follow Up Date
```

A starter file is provided: **`lead_upload_template.csv`**.

## Required headers
The upload is rejected up-front unless the header row contains:
- **`Company`**, **and**
- **`Phone`** *or* **`Contact`** (at least one of the two)

## Columns

| Header | Required | Rules / Notes |
|---|---|---|
| `Company` | ✅ | Max **50** characters |
| `Phone` | ⬤ one of Phone/Contact | Must be a valid **10-digit Indian mobile**: starts 6–9, digits only (`^[6-9][0-9]{9}$`). Spaces are stripped. Invalid → row skipped |
| `Contact` | ⬤ one of Phone/Contact | Alternate phone/landline; spaces stripped. Used when `Phone` is empty |
| `Datatype` | ✅ (value) | Must be **exactly** one of: `IndiaMart`, `Offline`, `TradeIndia`, `JustDial`, `WebPortals`, `Other` (case-sensitive). Invalid → row skipped |
| `Name` | optional | |
| `Email` | optional | |
| `Category` | optional | Max **15** chars. Auto-capitalized (e.g. `plastics` → `Plastics`) |
| `Location` | optional | Max **15** chars |
| `State` | optional | Max **15** chars |
| `Quantity` | optional | Number (non-numeric → `0`) |
| `Address` | optional | Stored as the street/address line |
| `Requirements` | optional | |
| `Remarks` | optional | |
| `Call Status` | optional | Defaults to `Not Called` |
| `Inquiry Date` | optional | Date (e.g. `YYYY-MM-DD`). Defaults to the import date if blank |
| `Follow Up Date` | optional | Date (e.g. `YYYY-MM-DD`). Blank = none |

## How rows are handled
- A row is **skipped** (not imported) if: missing both phone & contact, invalid
  phone format, an invalid `Datatype`, or any of Category/Location/State > 15 or
  Company > 50 characters.
- The response reports how many rows were imported vs skipped, with the reason
  per skipped row (phone, contact, company, location, state, category, datatype).

## Example rows
```csv
Name,Company,Phone,Contact,Email,Category,Datatype,Quantity,Location,State,Address,Requirements,Remarks,Call Status,Inquiry Date,Follow Up Date
Rahul Sharma,Acme Traders,9876543210,,rahul@acme.com,Plastics,IndiaMart,100,Delhi,Delhi,"12 MG Road, Delhi",Need bulk packaging,Hot lead,Not Called,2026-06-01,2026-06-10
Priya Verma,Verma Exports,,+91 22 4000 1234,priya@verma.com,Textiles,Offline,50,Mumbai,Maharashtra,"Andheri East, Mumbai",Sample requested,,Not Called,,
```

> Tip: wrap any value containing a comma (like an address) in double quotes.
