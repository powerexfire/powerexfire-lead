# Powerex Fire Leads

Lead Generation UI(Powerex Fire)

---------------------------------

Build a lead generation dashboard web app for a fire safety company (Powerex Fire).

🔹 PURPOSE:

This tool should collect business leads based on industry and location, then store and manage them in Google Sheets.

---

🔹 USER FLOW:

1. User selects:

   - Industry (e.g., Warehouse, Factory, Hospital, Hotel, Commercial Building)

   - Location (City or Area)

2. On submit:

   - Send data to webhook:

     https://redican.app.n8n.cloud/webhook/Powerex-Fire-Lead

3. System fetches search queries from Google Sheet:(sync button to update data)

   https://docs.google.com/spreadsheets/d/1013CNMc4Ydpr5x4TtNAlvbe3iPER0oFU-ysglfLWIYY/edit?gid=0#gid=0

4. Generate or display leads:

   - Business Name

   - Address

   - Phone

   - Email

   - Website

   - Google Maps Link

5. Save leads into:(sync button to update data)

   https://docs.google.com/spreadsheets/d/1013CNMc4Ydpr5x4TtNAlvbe3iPER0oFU-ysglfLWIYY/edit?gid=1560841529#gid=1560841529

---

🔹 UI REQUIREMENTS:

Create a clean dashboard UI with:

1. Top Navbar:

   - Logo (Powerex Fire)

   - Menu: Dashboard | Leads | Settings

2. Lead Search Form:

   - Dropdown: Industry

   - Input: Location

   - Submit Button (CTA: "Generate Leads")

3. Leads Table:

   - Columns: Name, Industry, Location, Phone, Email, Website

   - Add copy button for phone/email

   - Add "Open in Maps" button

4. Status Section:

   - Show: "Fetching leads..."

   - Show success / error messages

---

🔹 DESIGN STYLE:

- Professional, B2B industrial look

- Colors: Red + Dark Gray (fire safety theme)

- Clean cards, rounded corners, subtle shadows

- Font: Inter

- Responsive design (mobile + desktop)

---

🔹 TECH / LOGIC:

- Use webhook API for sending data

- Fetch Google Sheets data via API

- Store leads dynamically

- Handle loading, empty state, and errors

---

🔹 IMPORTANT:

- Do NOT use dummy data

- Use real structured data format

- Keep components modular (form, table, navbar)

- Ask me questions if anything is unclear before building

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://powerexfire-lead.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d25bd9ed-0532-4739-bd07-fe175f48a4a4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
