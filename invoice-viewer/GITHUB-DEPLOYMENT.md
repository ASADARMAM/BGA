# Deploying Changes to GitHub Pages

This guide will walk you through the process of deploying your updated invoice viewer and WhatsApp templates to GitHub Pages.

## Option 1: Using GitHub Web Interface (Recommended for Beginners)

1. **Go to your GitHub repository**
   - Open your web browser and navigate to `https://github.com/asadarmam/wecloud-invoices`
   - Sign in to your GitHub account if prompted

2. **Update the view.html file**
   - In the repository, navigate to the `view.html` file
   - Click on the file to open it
   - Click the pencil icon (Edit this file) in the upper right corner
   - Delete all existing content
   - Copy the entire content of your updated `view.html` file from your local project
   - Paste it into the GitHub editor

3. **Commit the changes**
   - Scroll down to the "Commit changes" section
   - Add a descriptive commit message like: "Update invoice viewer with professional design and customer details fix"
   - Select "Commit directly to the main branch"
   - Click the "Commit changes" button

4. **Add the WhatsApp templates file**
   - Go back to the repository main page
   - Click the "Add file" button and select "Create new file"
   - Name the file `whatsapp-templates.html`
   - Copy the content from your local `whatsapp-templates.html` file
   - Paste it into the GitHub editor
   - Add a commit message like: "Add professional WhatsApp message templates"
   - Click "Commit new file"

5. **Create the js directory for message-generator.js (if it doesn't exist)**
   - Go back to the repository main page
   - Click the "Add file" button and select "Create new file"
   - Name the file `js/message-generator.js` (GitHub will automatically create the js directory)
   - Copy the content from your local `js/message-generator.js` file
   - Paste it into the GitHub editor
   - Add a commit message like: "Add WhatsApp message generator script"
   - Click "Commit new file"

## Option 2: Using Git Command Line (For Advanced Users)

If you have Git installed on your computer:

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/asadarmam/wecloud-invoices.git
cd wecloud-invoices

# If you already have the repository cloned, pull latest changes
git pull

# Copy your updated files
cp /path/to/wecloud/invoice-viewer/view.html .
cp /path/to/wecloud/invoice-viewer/whatsapp-templates.html .
mkdir -p js
cp /path/to/wecloud/invoice-viewer/js/message-generator.js ./js/

# Add the files to git
git add view.html
git add whatsapp-templates.html
git add js/message-generator.js

# Commit the changes
git commit -m "Update invoice viewer and add WhatsApp templates"

# Push to GitHub
git push
```

## Verifying Your Deployment

1. **Wait for GitHub Pages to update**
   - GitHub Pages typically takes 1-2 minutes to update after you push changes
   - You can check the status in the "Actions" tab of your repository

2. **Test the invoice viewer**
   - Open a new private/incognito browser window (to avoid caching issues)
   - Navigate to `https://asadarmam.github.io/wecloud-invoices/view.html?id=YOURINVOICEID&v=1.5`
   - Verify that the invoice displays correctly with customer details
   - Check that the styling looks professional

3. **Test the WhatsApp templates**
   - Navigate to `https://asadarmam.github.io/wecloud-invoices/whatsapp-templates.html`
   - Verify that the templates are displayed correctly
   - Test the copy buttons to ensure they work

## Troubleshooting

If your changes don't appear after deployment:

1. **Clear browser cache**
   - Hard refresh your browser (Ctrl+F5 on Windows/Linux or Cmd+Shift+R on Mac)
   - Or try in a private/incognito window

2. **Check for deployment errors**
   - Go to the "Actions" tab in your GitHub repository
   - Look for any failed workflows or deployment errors

3. **Verify file paths**
   - Make sure all file paths and references are correct
   - GitHub Pages is case-sensitive, so ensure filenames match exactly

4. **Add version parameter**
   - Add `?v=1.5` to the end of your URLs to bypass caching
   - For example: `https://asadarmam.github.io/wecloud-invoices/view.html?id=YOURINVOICEID&v=1.5`

## Next Steps

After successfully deploying to GitHub Pages:

1. Update your WeCloud application to use the new WhatsApp message templates
2. Test sending invoice notifications with the new professional format
3. Gather feedback from customers on the improved invoice design 