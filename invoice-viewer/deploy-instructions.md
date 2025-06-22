# Deploying to GitHub Pages

Follow these steps to deploy your invoice viewer to GitHub Pages:

## 1. Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your account
2. Click on the "+" icon in the top-right corner and select "New repository"
3. Name your repository `wecloud-invoices`
4. Make it public or private as needed
5. Click "Create repository"

## 2. Initialize and Push Your Code

```bash
# Navigate to the invoice-viewer directory
cd invoice-viewer

# Initialize git repository
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial commit of invoice viewer"

# Add the remote repository (replace with your actual GitHub username)
git remote add origin https://github.com/asadarmam/wecloud-invoices.git

# Push to GitHub
git push -u origin main
```

## 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on "Settings"
3. Scroll down to the "GitHub Pages" section
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait a few minutes for GitHub to deploy your site
7. Your site will be available at `https://asadarmam.github.io/wecloud-invoices/`

## 4. Update Your Invoice Links

After your site is deployed, update the `INVOICE_BASE_URL` in the following files:

1. `js/invoiceViewer.js` in your main WeCloud project
2. `js/modules/whatsapp/sendInvoiceLink.js` in your main WeCloud project

Replace:
```javascript
const INVOICE_BASE_URL = "https://yourusername.github.io/wecloud-invoices/view.html?id=";
```

With your actual GitHub Pages URL:
```javascript
const INVOICE_BASE_URL = "https://asadarmam.github.io/wecloud-invoices/view.html?id=";
```

## 5. Deploying Your Main WeCloud Application

For your main WeCloud application, create a separate repository:

1. Create a new repository named `BGA` on GitHub
2. Initialize and push your main WeCloud code to this repository:

```bash
# Navigate to your main WeCloud directory
cd ..

# Initialize git repository
git init

# Add all files (except the invoice-viewer directory)
git add .
git rm --cached -r invoice-viewer

# Commit the files
git commit -m "Initial commit of WeCloud application"

# Add the remote repository
git remote add origin https://github.com/asadarmam/BGA.git

# Push to GitHub
git push -u origin main
```

3. Enable GitHub Pages for this repository as well
4. Your main application will be available at `https://asadarmam.github.io/BGA/`

## 6. Test Your Invoice Viewer

1. Create a test invoice in your WeCloud system
2. Send a test message with the invoice link
3. Click on the link to verify that the invoice displays correctly

## 7. Updating Your Invoice Viewer

When you need to make changes to your invoice viewer:

```bash
# Navigate to the invoice-viewer directory
cd invoice-viewer

# Make your changes to the files

# Add the changed files
git add .

# Commit the changes
git commit -m "Updated invoice viewer"

# Push to GitHub
git push origin main
```

GitHub Pages will automatically update with your changes within a few minutes.