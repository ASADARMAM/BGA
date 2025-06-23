# How to Update Your Invoice Viewer

We've completely redesigned the invoice viewer with a professional look and feel similar to invoices from major companies. The latest update includes fixes for customer details display, ensuring that actual customer names and information are shown. Follow these steps to deploy the updated version to GitHub Pages.

## Option 1: Using GitHub Web Interface (Easiest)

1. Go to your GitHub repository at `https://github.com/asadarmam/wecloud-invoices`
2. Navigate to the `view.html` file
3. Click the pencil icon (Edit this file)
4. Delete all existing content and paste the entire content of your updated `view.html` file
5. Scroll down and click "Commit changes"
6. Add a commit message like "Fix customer details display and enhance invoice design"
7. Click "Commit changes" button

The changes will be deployed to GitHub Pages automatically within a few minutes.

## Option 2: Using Git Command Line

If you have Git installed on your computer:

```bash
# Navigate to your local wecloud-invoices repository
cd path/to/wecloud-invoices

# Pull latest changes
git pull

# Copy the updated view.html file from your WeCloud project
cp /path/to/wecloud/invoice-viewer/view.html .

# Add the file to git
git add view.html

# Commit the changes
git commit -m "Fix customer details display and enhance invoice design"

# Push to GitHub
git push
```

## Testing Your Deployment

After deploying, you need to ensure your browser loads the new version:

1. Open the invoice link in a new private/incognito browser window
2. Or try adding a version parameter to force a refresh: `?id=YOURINVOICEID&v=1.4`
3. If you still see issues, try hard refreshing the page:
   - Windows/Linux: Ctrl+F5 or Ctrl+Shift+R
   - Mac: Cmd+Shift+R

## What Changed?

1. **Fixed Customer Details Display**:
   - Added code to fetch customer details from the users collection using the userId
   - Implemented fallback to invoice data if user details aren't available
   - Ensured customer name, phone, email, and address are properly displayed

2. **Fixed Package Information**:
   - Added code to fetch package details from the packages collection
   - Shows proper package name instead of generic "Service" text

3. **Updated Company Information**:
   - Updated company address to correct location
   - Ensured consistent company information in header and footer

4. **All Previous Enhancements**:
   - Professional company branding
   - Enhanced visual elements and styling
   - Improved invoice items and amounts
   - Better status indicators
   - Professional footer
   - Fixed technical issues

## Need More Help?

If you continue to have issues, try:

1. Check browser console for any errors (F12 > Console tab)
2. Verify the invoice data in Firebase contains valid userId and packageId fields
3. Try adding a specific date to the URL: `?id=YOURINVOICEID&date=2023-06-01` 