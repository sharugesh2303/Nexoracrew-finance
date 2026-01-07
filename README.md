# NexoraCrew Financial Suite

Professional auditor-level money management and purchase tracking system for NexoraCrew.

## Features
- **Real-time Dashboard**: Live financial tracking with Supabase integration.
- **Multi-User Role Management**: Track who added what transaction.
- **Team Investment Analysis**: Visualize team spending vs single investments.
- **Audit-Ready Reports**: Export PDF statements and Excel sheets.

## Tech Stack
- React 18
- TypeScript
- Tailwind CSS
- Supabase (Real-time Database)
- Recharts (Data Visualization)
- jspdf & xlsx (Reporting)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Supabase:
   - Create a project at [database.new](https://database.new)
   - Copy URL and ANON KEY to `lib/supabase.ts`
   - Run the SQL setup script in your Supabase dashboard.

3. Run the app:
   ```bash
   npm start
   ```
