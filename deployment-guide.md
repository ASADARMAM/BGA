# WeCloud GitHub Pages Deployment Guide

This guide will help you deploy both your main WeCloud application and the invoice viewer to GitHub Pages.

## 1. Setting Up the Invoice Viewer Repository

### 1.1 Create the GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your account
2. Click on the "+" icon in the top-right corner and select "New repository"
3. Name your repository `wecloud-invoices`
4. Make it public (required for GitHub Pages with a free account)
5. Click "Create repository"

### 1.2 Push the Invoice Viewer Code

```bash
# Navigate to the invoice-viewer directory
cd invoice-viewer

# Initialize git repository
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial commit of invoice viewer"

# Add the remote repository
git remote add origin https://github.com/asadarmam/wecloud-invoices.git

# Push to GitHub
git push -u origin main
```

### 1.3 Enable GitHub Pages

1. Go to your `wecloud-invoices` repository on GitHub
2. Click on "Settings"
3. Scroll down to the "GitHub Pages" section
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait a few minutes for GitHub to deploy your site
7. Your invoice viewer will be available at `https://asadarmam.github.io/wecloud-invoices/`

## 2. Setting Up the Main WeCloud Application Repository

### 2.1 Create the GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your account
2. Click on the "+" icon in the top-right corner and select "New repository"
3. Name your repository `BGA`
4. Make it public (required for GitHub Pages with a free account)
5. Click "Create repository"

### 2.2 Push the Main WeCloud Code

```bash
# Navigate back to your main WeCloud directory
cd ..

# Initialize git repository
git init

# Add all files except the invoice-viewer directory
git add .
git rm --cached -r invoice-viewer

# Commit the files
git commit -m "Initial commit of WeCloud application"

# Add the remote repository
git remote add origin https://github.com/asadarmam/BGA.git

# Push to GitHub
git push -u origin main
```

### 2.3 Enable GitHub Pages

1. Go to your `BGA` repository on GitHub
2. Click on "Settings"
3. Scroll down to the "GitHub Pages" section
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait a few minutes for GitHub to deploy your site
7. Your main application will be available at `https://asadarmam.github.io/BGA/`

## 3. Testing Your Deployment

### 3.1 Test the Invoice Viewer

1. Go to `https://asadarmam.github.io/wecloud-invoices/`
2. Verify that the landing page loads correctly
3. Test viewing an invoice by going to `https://asadarmam.github.io/wecloud-invoices/view.html?id=INVOICE_ID` (replace INVOICE_ID with an actual invoice ID)

### 3.2 Test the Main Application

1. Go to `https://asadarmam.github.io/BGA/`
2. Verify that the dashboard loads correctly
3. Test creating an invoice and sending a WhatsApp message with the invoice link

## 4. Troubleshooting

### 4.1 Firebase Configuration

If you encounter issues with Firebase authentication or data access:

1. Make sure your Firebase project allows access from your GitHub Pages domains
2. Go to the Firebase Console > Project Settings > Your Apps > Authentication > Authorized Domains
3. Add both `asadarmam.github.io` and any other domains you're using

### 4.2 CORS Issues

If you encounter CORS issues when fetching data:

1. Go to the Firebase Console > Project Settings > Your Apps > Cloud Firestore > Rules
2. Update your rules to allow access from your GitHub Pages domains:

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null || request.origin.matches('https://asadarmam.github.io/.*');
    }
  }
}
```

### 4.3 Path Issues

If you encounter issues with file paths:

1. Make sure all paths in your HTML files are relative (e.g., `css/styles.css` instead of `/css/styles.css`)
2. Update any absolute paths to include the repository name (e.g., `/BGA/css/styles.css`)

## 5. Updating Your Sites

### 5.1 Updating the Invoice Viewer

```bash
# Navigate to the invoice-viewer directory
cd invoice-viewer

# Make your changes

# Add and commit the changes
git add .
git commit -m "Updated invoice viewer"

# Push to GitHub
git push origin main
```

### 5.2 Updating the Main Application

```bash
# Navigate to your main WeCloud directory
cd ..

# Make your changes

# Add and commit the changes
git add .
git commit -m "Updated WeCloud application"

# Push to GitHub
git push origin main
```

## 6. Custom Domain (Optional)

If you want to use a custom domain for your GitHub Pages sites:

1. Go to your repository on GitHub
2. Click on "Settings"
3. Scroll down to the "GitHub Pages" section
4. Under "Custom domain", enter your domain name
5. Click "Save"
6. Update your DNS settings to point to GitHub Pages
7. Update all URLs in your code to use your custom domain 