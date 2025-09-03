# Firebase Setup Instructions for Butchery Loyalty Program

## Required Firebase Configuration

To run this application, you need to set up a Firebase project with the following services:

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "Butchery Loyalty Program"
3. Enable Google Analytics (optional)

### 2. Enable Authentication
1. In Firebase Console, go to Authentication > Sign-in method
2. Enable "Email/Password" provider
3. Note: We convert phone numbers to email format for authentication

### 3. Enable Firestore Database
1. Go to Firestore Database in Firebase Console
2. Create database in production mode
3. Set up security rules (see below)

### 4. Get Firebase Configuration
1. Go to Project Settings > General
2. In "Your apps" section, add a web app
3. Copy the Firebase configuration object
4. Replace the config in `firebase-config.js` with your actual config

### 5. Required Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Customers can read/write their own data
    match /customers/{phone} {
      allow read, write: if request.auth != null && 
        resource.data.uid == request.auth.uid;
    }
    
    // Admins can read all customer data
    match /customers/{phone} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // Purchases - admins can write, customers can read their own
    match /purchases/{purchaseId} {
      allow read: if request.auth != null && 
        (resource.data.customerPhone == request.auth.token.phone || 
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // Redemptions - similar to purchases
    match /redemptions/{redemptionId} {
      allow read: if request.auth != null && 
        (resource.data.customerPhone == request.auth.token.phone || 
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // Admins collection - only admins can read
    match /admins/{adminId} {
      allow read: if request.auth != null && request.auth.uid == adminId;
    }
  }
}
```

### 6. Create Admin Account
1. Create a Firebase Auth user manually in the Firebase Console
2. Add the user's UID as a document in the `admins` collection
3. Example: Document ID = "admin-uid", Empty document content = {}

### 7. Test Data (Optional)
You can add some test customers manually in Firestore:
```
Collection: customers
Document ID: +1234567890
Data: {
  points: 150,
  name: "Test Customer",
  createdAt: [current timestamp],
  uid: "firebase-auth-uid"
}
```

## Local Development
1. Update firebase-config.js with your Firebase configuration
2. Serve the files using a local web server (required for Firebase to work)
3. Open index.html in your browser

## Deployment Options
- **Replit**: Just update the Firebase config and deploy
- **Netlify**: Drag and drop all files
- **Firebase Hosting**: Use Firebase CLI to deploy
- **GitHub Pages**: Push to repository and enable Pages

## Important Notes
- Phone numbers are converted to email format for Firebase Auth
- All database operations use Firestore transactions for consistency
- Points calculation: floor(amount / 100) * 5
- Admin privileges are checked via the `admins` collection