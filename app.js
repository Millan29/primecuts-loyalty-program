// Main Application Logic for Butchery Loyalty Program
// This file contains shared utilities and functions used across all pages

/*
AUTHENTICATION FLOW:
1. Customer Registration: Phone number converted to email format for Firebase Auth
2. Customer Login: Email/password authentication with phone number verification
3. Admin Login: Standard email/password authentication with admin role verification
4. Session Management: Firebase Auth state + sessionStorage for phone numbers

POINTS SYSTEM:
- Customers earn points: floor(purchase_amount / 100) * 5
- Redemption rates: 100 points = 0.5kg, 180 points = 0.75kg
- All point operations use Firestore transactions for data consistency

DATABASE OPERATIONS:
- All customer data stored in Firestore collections
- Transactions ensure atomic operations for points
- Admin operations require authentication and role verification
*/

// Global utility functions available to all pages
window.AppUtils = {
    
    // Format phone number for consistent storage
    formatPhoneNumber(phone) {
        // Remove all non-digit characters except +
        return phone.replace(/[^\d+]/g, '');
    },
    
    // Convert phone number to email format for Firebase Auth
    phoneToEmail(phone) {
        const formattedPhone = this.formatPhoneNumber(phone);
        return `${formattedPhone}@butchery.local`;
    },
    
    // Validate phone number format
    isValidPhoneNumber(phone) {
        const formatted = this.formatPhoneNumber(phone);
        // Basic validation: starts with + and has at least 10 digits
        return /^\+\d{10,15}$/.test(formatted);
    },
    
    // Calculate points from purchase amount
    calculatePoints(amount) {
        return Math.floor(amount / 100) * 5;
    },
    
    // Format currency for display
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    // Format date for display
    formatDate(date, includeTime = true) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return new Intl.DateTimeFormat('en-US', options).format(date);
    },
    
    // Show loading state on buttons
    setButtonLoading(button, loading, originalText = null) {
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
            button.disabled = true;
        } else {
            button.textContent = originalText || button.dataset.originalText || 'Submit';
            button.disabled = false;
            delete button.dataset.originalText;
        }
    },
    
    // Generic error handler for Firebase errors
    getErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'Account not found. Please check your phone number.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/email-already-in-use': 'An account with this phone number already exists.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'permission-denied': 'Permission denied. Please check your credentials.',
            'not-found': 'Document not found.',
            'already-exists': 'Document already exists.',
            'resource-exhausted': 'Database quota exceeded. Please try again later.',
            'unauthenticated': 'Authentication required. Please log in again.'
        };
        
        const code = error.code || error.message;
        return errorMessages[code] || error.message || 'An unexpected error occurred.';
    },
    
    // Debounce function for search inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Local storage helpers
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.warn('Failed to save to localStorage:', error);
            }
        },
        
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('Failed to read from localStorage:', error);
                return defaultValue;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.warn('Failed to remove from localStorage:', error);
            }
        }
    }
};

// Enhanced Database Helpers with better error handling and validation
if (typeof window !== 'undefined' && window.DatabaseHelpers) {
    const originalHelpers = window.DatabaseHelpers;
    
    // Extend existing DatabaseHelpers with additional functionality
    window.DatabaseHelpers = {
        ...originalHelpers,
        
        // Enhanced customer creation with validation
        async createCustomer(phoneNumber, password, name = '') {
            try {
                // Validate inputs
                if (!AppUtils.isValidPhoneNumber(phoneNumber)) {
                    return { success: false, error: 'Invalid phone number format' };
                }
                
                if (password.length < 6) {
                    return { success: false, error: 'Password must be at least 6 characters' };
                }
                
                const formattedPhone = AppUtils.formatPhoneNumber(phoneNumber);
                const email = AppUtils.phoneToEmail(formattedPhone);
                
                // Check if customer already exists
                const existingCustomer = await db.collection('customers').doc(formattedPhone).get();
                if (existingCustomer.exists) {
                    return { success: false, error: 'Customer with this phone number already exists' };
                }
                
                // Create Firebase Auth user
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                
                // Create customer document
                await db.collection('customers').doc(formattedPhone).set({
                    points: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    name: name.trim(),
                    uid: userCredential.user.uid,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                return { success: true, user: userCredential.user, phone: formattedPhone };
            } catch (error) {
                console.error('Error creating customer:', error);
                return { success: false, error: AppUtils.getErrorMessage(error) };
            }
        },
        
        // Enhanced customer login
        async loginCustomer(phoneNumber, password) {
            try {
                if (!AppUtils.isValidPhoneNumber(phoneNumber)) {
                    return { success: false, error: 'Invalid phone number format' };
                }
                
                const formattedPhone = AppUtils.formatPhoneNumber(phoneNumber);
                const email = AppUtils.phoneToEmail(formattedPhone);
                
                // Authenticate with Firebase
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                
                // Verify customer document exists
                const customerDoc = await db.collection('customers').doc(formattedPhone).get();
                if (!customerDoc.exists) {
                    await auth.signOut();
                    return { success: false, error: 'Customer account not found' };
                }
                
                // Update last login
                await db.collection('customers').doc(formattedPhone).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                return { 
                    success: true, 
                    user: userCredential.user, 
                    phone: formattedPhone,
                    customer: customerDoc.data()
                };
            } catch (error) {
                console.error('Error logging in customer:', error);
                return { success: false, error: AppUtils.getErrorMessage(error) };
            }
        },
        
        // Get customer purchase history
        async getCustomerPurchases(phoneNumber, limit = 10) {
            try {
                const snapshot = await db.collection('purchases')
                    .where('customerPhone', '==', phoneNumber)
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();
                
                const purchases = [];
                snapshot.forEach(doc => {
                    purchases.push({ id: doc.id, ...doc.data() });
                });
                
                return { success: true, purchases };
            } catch (error) {
                console.error('Error getting purchases:', error);
                return { success: false, error: AppUtils.getErrorMessage(error) };
            }
        },
        
        // Get customer redemption history
        async getCustomerRedemptions(phoneNumber, limit = 10) {
            try {
                const snapshot = await db.collection('redemptions')
                    .where('customerPhone', '==', phoneNumber)
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();
                
                const redemptions = [];
                snapshot.forEach(doc => {
                    redemptions.push({ id: doc.id, ...doc.data() });
                });
                
                return { success: true, redemptions };
            } catch (error) {
                console.error('Error getting redemptions:', error);
                return { success: false, error: AppUtils.getErrorMessage(error) };
            }
        },
        
        // Get statistics for admin dashboard
        async getStatistics() {
            try {
                const [customersSnapshot, purchasesSnapshot, redemptionsSnapshot] = await Promise.all([
                    db.collection('customers').get(),
                    db.collection('purchases').get(),
                    db.collection('redemptions').get()
                ]);
                
                let totalRevenue = 0;
                let totalPointsEarned = 0;
                let totalPointsRedeemed = 0;
                
                purchasesSnapshot.forEach(doc => {
                    const data = doc.data();
                    totalRevenue += data.amount || 0;
                    totalPointsEarned += data.pointsEarned || 0;
                });
                
                redemptionsSnapshot.forEach(doc => {
                    const data = doc.data();
                    totalPointsRedeemed += data.pointsSpent || 0;
                });
                
                return {
                    success: true,
                    stats: {
                        totalCustomers: customersSnapshot.size,
                        totalPurchases: purchasesSnapshot.size,
                        totalRedemptions: redemptionsSnapshot.size,
                        totalRevenue,
                        totalPointsEarned,
                        totalPointsRedeemed,
                        activePoints: totalPointsEarned - totalPointsRedeemed
                    }
                };
            } catch (error) {
                console.error('Error getting statistics:', error);
                return { success: false, error: AppUtils.getErrorMessage(error) };
            }
        }
    };
}

// Global authentication state handler
if (typeof firebase !== 'undefined' && firebase.auth) {
    // Set up global auth state listener
    firebase.auth().onAuthStateChanged((user) => {
        // Store auth state for easy access
        window.currentUser = user;
        
        // Emit custom event for pages to listen to
        window.dispatchEvent(new CustomEvent('authStateChanged', { 
            detail: { user, isAuthenticated: !!user }
        }));
    });
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Show user-friendly error message
    const errorMessage = AppUtils.getErrorMessage(event.reason);
    
    // Find and show error in any visible message div
    const messageDiv = document.querySelector('.message, #message');
    if (messageDiv) {
        messageDiv.textContent = errorMessage;
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
    }
    
    // Prevent the default browser error handling
    event.preventDefault();
});

// Console logging for debugging (remove in production)
if (typeof console !== 'undefined') {
    console.log('🥩 Butchery Loyalty App Initialized');
    console.log('Available utilities:', Object.keys(window.AppUtils || {}));
    console.log('Firebase available:', typeof firebase !== 'undefined');
}