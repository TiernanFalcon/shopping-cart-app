import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"

const firebaseConfig = {
  apiKey: "AIzaSyDzy7NksBeUBDqWRJSKHXvpy-TnNwcs2S4",
  authDomain: "realtime-database-b9772.firebaseapp.com",
  databaseURL: "https://realtime-database-b9772-default-rtdb.firebaseio.com",
  projectId: "realtime-database-b9772",
  storageBucket: "realtime-database-b9772.firebasestorage.app",
  messagingSenderId: "854432919983",
  appId: "1:854432919983:web:d0403b6855a220aa0c3f5a"
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
const auth = getAuth(app)
const provider = new GoogleAuthProvider()

const shoppingListInDB = ref(database, "shoppingList")

// DOM elements
const inputFieldEl = document.getElementById("input-field")
const addButtonEl = document.getElementById("add-button")
const shoppingListEl = document.getElementById("shopping-list")
const signInScreenEl = document.getElementById("sign-in-screen")
const appScreenEl = document.getElementById("app-screen")
const signInButtonEl = document.getElementById("sign-in-button")
const signOutButtonEl = document.getElementById("sign-out-button")
const userEmailEl = document.getElementById("user-email")

// Track rendered items for efficient updates
const renderedItems = new Map()
let unsubscribe = null

// Auth state listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        showApp(user)
        subscribeToShoppingList()
    } else {
        // User is signed out
        showSignIn()
        unsubscribeFromShoppingList()
    }
})

// Sign in
signInButtonEl.addEventListener("click", () => {
    signInWithPopup(auth, provider)
        .catch((error) => {
            if (error.code === 'auth/unauthorized-domain') {
                alert("This domain isn't authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains")
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup, do nothing
            } else {
                console.error("Sign in error:", error)
                alert("Couldn't sign in. Please try again.")
            }
        })
})

// Sign out
signOutButtonEl.addEventListener("click", () => {
    signOut(auth)
})

function showApp(user) {
    signInScreenEl.classList.add("hidden")
    appScreenEl.classList.remove("hidden")
    userEmailEl.textContent = user.email
}

function showSignIn() {
    signInScreenEl.classList.remove("hidden")
    appScreenEl.classList.add("hidden")
    renderedItems.clear()
    shoppingListEl.innerHTML = ""
}

function subscribeToShoppingList() {
    unsubscribeFromShoppingList()
    shoppingListEl.innerHTML = '<li class="loading">Loading...</li>'
    
    unsubscribe = onValue(shoppingListInDB, (snapshot) => {
        if (snapshot.exists()) {
            const newItems = new Map(Object.entries(snapshot.val()))
            
            // Remove items that no longer exist
            for (const [id, el] of renderedItems) {
                if (!newItems.has(id)) {
                    removeItemWithAnimation(id, el)
                }
            }
            
            // Add or update items
            for (const [id, value] of newItems) {
                const itemData = normalizeItem(value)
                
                if (renderedItems.has(id)) {
                    updateItemEl(id, itemData)
                } else {
                    appendItemToShoppingListEl(id, itemData)
                }
            }
        } else {
            renderedItems.clear()
            shoppingListEl.innerHTML = '<li class="empty-state">No items here... yet</li>'
        }
    }, (error) => {
        console.error("Database error:", error)
        if (error.code === 'PERMISSION_DENIED') {
            shoppingListEl.innerHTML = '<li class="empty-state">Access denied. Your email may not be on the allowed list.</li>'
        }
    })
}

function unsubscribeFromShoppingList() {
    if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
    }
}

// Add item on button click
addButtonEl.addEventListener("click", addItem)

// Add item on Enter key
inputFieldEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        addItem()
        inputFieldEl.blur() // Dismiss keyboard on mobile
    }
})

function addItem() {
    const inputValue = inputFieldEl.value.trim()
    
    if (!inputValue) {
        inputFieldEl.focus()
        return
    }
    
    push(shoppingListInDB, {
        text: inputValue,
        completed: false
    })
    
    inputFieldEl.value = ""
}

function normalizeItem(value) {
    if (typeof value === "string") {
        return { text: value, completed: false }
    }
    return value
}

function appendItemToShoppingListEl(id, itemData) {
    const message = shoppingListEl.querySelector('.loading, .empty-state')
    if (message) message.remove()
    
    const li = document.createElement("li")
    li.dataset.id = id
    li.textContent = itemData.text
    
    if (itemData.completed) {
        li.classList.add("completed")
    }
    
    let touchStartX = 0
    let touchStartY = 0
    let touchCurrentX = 0
    let isSwiping = false
    let touchHandled = false
    let isScrolling = false
    
    li.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
        touchCurrentX = touchStartX
        isSwiping = false
        touchHandled = false
        isScrolling = false
        li.classList.remove("swiping")
    }, { passive: true })
    
    li.addEventListener("touchmove", (e) => {
        touchCurrentX = e.touches[0].clientX
        const diffX = touchStartX - touchCurrentX
        const diffY = Math.abs(e.touches[0].clientY - touchStartY)
        
        // If moved vertically more than 10px, user is scrolling
        if (diffY > 10) {
            isScrolling = true
            li.style.transform = ""
            li.classList.remove("swiping")
            return
        }
        
        // Horizontal swipe
        if (diffX > 10 && !isScrolling) {
            isSwiping = true
            li.classList.add("swiping")
            const translateX = Math.min(Math.max(-diffX, -100), 0)
            li.style.transform = `translateX(${translateX}px)`
        }
    }, { passive: true })
    
    li.addEventListener("touchend", () => {
        touchHandled = true
        const diffX = touchStartX - touchCurrentX
        
        if (isScrolling) {
            // Was scrolling, do nothing
            return
        } else if (diffX > 80) {
            deleteItem(id, li)
        } else if (isSwiping) {
            li.style.transform = ""
            li.classList.remove("swiping")
        } else {
            toggleCompleted(id, li)
        }
    })
    
    li.addEventListener("click", (e) => {
        // Prevent click from firing after touch was already handled
        if (touchHandled) {
            touchHandled = false
            return
        }
        toggleCompleted(id, li)
    })
    
    li.classList.add("entering")
    shoppingListEl.append(li)
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            li.classList.remove("entering")
        })
    })
    
    renderedItems.set(id, li)
}

function updateItemEl(id, itemData) {
    const li = renderedItems.get(id)
    if (!li) return
    
    li.textContent = itemData.text
    li.classList.toggle("completed", itemData.completed)
}

function toggleCompleted(id, li) {
    // Read current state from DOM, not stale closure
    const currentlyCompleted = li.classList.contains("completed")
    const text = li.textContent
    
    const itemRef = ref(database, `shoppingList/${id}`)
    update(itemRef, {
        text: text,
        completed: !currentlyCompleted
    })
}

function deleteItem(id, li) {
    // Animate out
    li.style.transition = "transform 0.2s ease, opacity 0.2s ease"
    li.style.transform = "translateX(-100%)"
    li.style.opacity = "0"
    
    // Remove from Firebase (slight delay for animation)
    setTimeout(() => {
        const itemRef = ref(database, `shoppingList/${id}`)
        remove(itemRef)
        renderedItems.delete(id) 
    }, 150)
}

function removeItemWithAnimation(id, li) {
    // Animate out
    li.style.transition = "transform 0.2s ease, opacity 0.2s ease"
    li.style.transform = "translateX(-20px)"
    li.style.opacity = "0"
    
    setTimeout(() => {
        li.remove()
        renderedItems.delete(id)
        
        if (renderedItems.size === 0) {
            shoppingListEl.innerHTML = '<li class="empty-state">No items here... yet</li>'
        }
    }, 200)
}
