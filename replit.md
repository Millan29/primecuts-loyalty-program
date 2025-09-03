# Overview

A lightweight web-based loyalty program application designed for small butchery businesses. The system manages customer points accumulation (5 points per $100 spent) and redemption for meat rewards (0.5kg for 100 points, 0.75kg for 180 points). Built as a static web application with Firebase backend services for authentication and data storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Static HTML/CSS/JavaScript**: Multi-page application with dedicated pages for customer signup, login, dashboard, and admin panel
- **Mobile-First Design**: Responsive CSS with gradient backgrounds and clean, minimalist UI components
- **Client-Side Routing**: Simple page-based navigation without complex routing frameworks
- **Real-Time Updates**: Direct Firebase SDK integration for live data synchronization

## Authentication System
- **Phone-to-Email Conversion**: Customer phone numbers converted to email format (`{phone}@butchery.local`) for Firebase Auth compatibility
- **Dual Authentication Flow**: Separate login paths for customers (phone + password) and admins (email + password)
- **Role-Based Access**: Admin privileges verified through Firestore `admins` collection membership
- **Session Management**: Firebase Auth state combined with sessionStorage for phone number persistence

## Data Architecture
- **Firestore Collections**:
  - `customers/{phone}`: Points balance, registration data, and customer metadata
  - `purchases/{autoId}`: Transaction records with customer reference and point calculations
  - `redemptions/{autoId}`: Reward redemption history with point deductions
  - `admins/{uid}`: Admin role verification documents
- **Atomic Operations**: Firestore transactions ensure data consistency for point awards and redemptions
- **Security Rules**: Customer data isolation with admin override capabilities

## Business Logic
- **Point Calculation**: Automatic calculation using `floor(amount / 100) * 5` formula
- **Reward Tiers**: Two-tier redemption system (100 points = 0.5kg, 180 points = 0.75kg)
- **Transaction Tracking**: Complete audit trail for all point movements and purchases

## Admin Dashboard Features
- **Customer Search**: Phone number-based customer lookup functionality
- **Purchase Processing**: Real-time point calculation and customer balance updates
- **Redemption Management**: Direct point deduction with reward fulfillment tracking
- **Transaction History**: Comprehensive view of customer activity and point movements

# External Dependencies

## Firebase Services
- **Firebase Authentication**: Customer and admin login management with email/password provider
- **Firestore Database**: NoSQL document storage for all application data with real-time synchronization
- **Firebase Hosting**: Static web application deployment platform (optional)

## CDN Dependencies
- **Firebase Web SDK v9.22.0**: Client-side Firebase integration via Google's CDN
- **HTTP Server**: Local development server for testing (via npm package)

## Development Tools
- **Node.js Package Manager**: Basic package.json setup with http-server for local development
- **No Build Process**: Direct browser execution without compilation or bundling steps