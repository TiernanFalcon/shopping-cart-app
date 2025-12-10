import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, update, set, get } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"
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

// Constants
const MAIN_LIST_ID = 'main'
const MAIN_LIST_NAME = 'Main List'

// DOM elements - Screens
const loadingScreenEl = document.getElementById("loading-screen")
const signInScreenEl = document.getElementById("sign-in-screen")
const itemsScreenEl = document.getElementById("items-screen")
const listsScreenEl = document.getElementById("lists-screen")

// DOM elements - Items screen
const itemInputEl = document.getElementById("item-input")
const addItemButtonEl = document.getElementById("add-item-button")
const shoppingListEl = document.getElementById("shopping-list")
const listsButtonEl = document.getElementById("lists-button")
const currentListNameEl = document.getElementById("current-list-name")
const userEmailItemsEl = document.getElementById("user-email-items")

// DOM elements - Lists screen
const listInputEl = document.getElementById("list-input")
const createListButtonEl = document.getElementById("create-list-button")
const listsListEl = document.getElementById("lists-list")
const backButtonEl = document.getElementById("back-button")
const userEmailListsEl = document.getElementById("user-email-lists")
const listsHelperEl = document.getElementById("lists-helper")

// DOM elements - Auth
const signInButtonEl = document.getElementById("sign-in-button")
const signOutButtons = document.querySelectorAll(".sign-out-button")

// DOM elements - Modal
const confirmModalEl = document.getElementById("confirm-modal")
const confirmMessageEl = document.getElementById("confirm-message")
const confirmCancelEl = document.getElementById("confirm-cancel")
const confirmOkEl = document.getElementById("confirm-ok")

// State
let currentListId = null
let currentUser = null
let itemsUnsubscribe = null
let listsUnsubscribe = null
const renderedItems = new Map()
const renderedLists = new Map()

// Confirmation modal promise
let confirmResolve = null

// ============ AUTH ============

onAuthStateChanged(auth, (user) => {
    loadingScreenEl.classList.add("hidden")
    
    if (user) {
        currentUser = user
        userEmailItemsEl.textContent = user.email
        userEmailListsEl.textContent = user.email
        
        const lastListId = localStorage.getItem('lastListId') || MAIN_LIST_ID
        
        if (lastListId !== MAIN_LIST_ID) {
            // Verify the list still exists
            const listMetaRef = ref(database, `lists/${lastListId}/meta`)
            get(listMetaRef).then(snapshot => {
                if (snapshot.exists()) {
                    selectList(lastListId, false)
                } else {
                    // List was deleted, fall back to main
                    localStorage.removeItem('lastListId')
                    selectList(MAIN_LIST_ID, false)
                }
                showItemsScreen(false)
            }).catch(() => {
                // On error, fall back to main
                selectList(MAIN_LIST_ID, false)
                showItemsScreen(false)
            })
        } else {
            selectList(MAIN_LIST_ID, false)
            showItemsScreen(false)
        }
    } else {
        currentUser = null
        showSignInScreen()
        unsubscribeAll()
    }
})

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

signOutButtons.forEach(button => {
    button.addEventListener("click", () => {
        signOut(auth)
    })
})

// ============ NAVIGATION ============

function showSignInScreen() {
    loadingScreenEl.classList.add("hidden")
    signInScreenEl.classList.remove("hidden")
    itemsScreenEl.classList.add("hidden")
    listsScreenEl.classList.add("hidden")
}

function showItemsScreen(animate = true) {
    signInScreenEl.classList.add("hidden")
    listsScreenEl.classList.add("hidden")
    
    if (animate) {
        itemsScreenEl.classList.remove("hidden")
        itemsScreenEl.classList.add("slide-in-right")
        setTimeout(() => {
            itemsScreenEl.classList.remove("slide-in-right")
        }, 300)
    } else {
        itemsScreenEl.classList.remove("hidden")
    }
}

function showListsScreen() {
    itemsScreenEl.classList.add("hidden")
    listsScreenEl.classList.remove("hidden")
    listsScreenEl.classList.add("slide-in-left")
    
    setTimeout(() => {
        listsScreenEl.classList.remove("slide-in-left")
    }, 300)
    
    subscribeToLists()
}

// Navigation buttons
listsButtonEl.addEventListener("click", showListsScreen)
backButtonEl.addEventListener("click", () => showItemsScreen(true))

// Swipe right to go back from lists screen
let listsSwipeStartX = 0
let listsSwipeCurrentX = 0

listsScreenEl.addEventListener("touchstart", (e) => {
    listsSwipeStartX = e.touches[0].clientX
    listsSwipeCurrentX = listsSwipeStartX
}, { passive: true })

listsScreenEl.addEventListener("touchmove", (e) => {
    listsSwipeCurrentX = e.touches[0].clientX
}, { passive: true })

listsScreenEl.addEventListener("touchend", () => {
    const diff = listsSwipeCurrentX - listsSwipeStartX
    // Swipe right more than 80px to go back
    if (diff > 80) {
        showItemsScreen(true)
    }
})

// ============ HELPER FUNCTIONS ============

function getItemsRef(listId) {
    if (listId === MAIN_LIST_ID) {
        return ref(database, "shoppingList")
    }
    return ref(database, `lists/${listId}/items`)
}

function getItemPath(listId, itemId) {
    if (listId === MAIN_LIST_ID) {
        return `shoppingList/${itemId}`
    }
    return `lists/${listId}/items/${itemId}`
}

// ============ ITEMS ============

function selectList(listId, animate = true) {
    currentListId = listId
    localStorage.setItem('lastListId', listId)
    
    // Update header
    if (listId === MAIN_LIST_ID) {
        currentListNameEl.textContent = MAIN_LIST_NAME
    } else {
        // Fetch list name
        const listMetaRef = ref(database, `lists/${listId}/meta`)
        get(listMetaRef).then(snapshot => {
            if (snapshot.exists()) {
                currentListNameEl.textContent = snapshot.val().name
            }
        })
    }
    
    subscribeToItems(listId)
    
    if (animate) {
        showItemsScreen(true)
    }
}



function subscribeToItems(listId) {
    // Unsubscribe from previous
    if (itemsUnsubscribe) {
        itemsUnsubscribe()
        itemsUnsubscribe = null
    }
    
    renderedItems.clear()
    shoppingListEl.innerHTML = '<li class="loading">One moment...</li>'
    
    const itemsRef = getItemsRef(listId)
    
    itemsUnsubscribe = onValue(itemsRef, (snapshot) => {
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

function normalizeItem(value) {
    if (typeof value === "string") {
        return { text: value, completed: false }
    }
    return value
}

// Add item
addItemButtonEl.addEventListener("click", addItem)
itemInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        addItem()
        itemInputEl.blur()
    }
})

function addItem() {
    const inputValue = itemInputEl.value.trim()
    
    if (!inputValue) {
        itemInputEl.focus()
        return
    }
    
    const itemsRef = getItemsRef(currentListId)
    push(itemsRef, {
        text: inputValue,
        completed: false
    })
    
    itemInputEl.value = ""
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
    
    setupItemTouchHandlers(li, id)
    
    li.classList.add("entering")
    shoppingListEl.append(li)
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            li.classList.remove("entering")
        })
    })
    
    renderedItems.set(id, li)
}

function setupItemTouchHandlers(li, id) {
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
        
        if (diffY > 10) {
            isScrolling = true
            li.style.transform = ""
            li.classList.remove("swiping")
            return
        }
        
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
            return
        } else if (diffX > 80) {
            deleteItemWithAnimation(id, li)
        } else if (isSwiping) {
            li.style.transform = ""
            li.classList.remove("swiping")
        } else {
            toggleItemCompleted(id, li)
        }
    })
    
    li.addEventListener("click", (e) => {
        if (touchHandled) {
            touchHandled = false
            return
        }
        toggleItemCompleted(id, li)
    })
}

function updateItemEl(id, itemData) {
    const li = renderedItems.get(id)
    if (!li) return
    
    li.textContent = itemData.text
    li.classList.toggle("completed", itemData.completed)
}



function toggleItemCompleted(id, li) {
    const currentlyCompleted = li.classList.contains("completed")
    const text = li.textContent    
    
    const itemRef = ref(database, getItemPath(currentListId, id))
    
    update(itemRef, {
        text: text,
        completed: !currentlyCompleted
    })
}

function deleteItemWithAnimation(id, li) {
    li.style.transition = "transform 0.2s ease, opacity 0.2s ease"
    li.style.transform = "translateX(-100%)"
    li.style.opacity = "0"
    
    setTimeout(() => {        
        const itemRef = ref(database, getItemPath(currentListId, id))
        remove(itemRef)
        renderedItems.delete(id)
    }, 150)
}

function removeItemWithAnimation(id, li) {
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

// ============ LISTS ============

function subscribeToLists() {
    if (listsUnsubscribe) {
        listsUnsubscribe()
        listsUnsubscribe = null
    }
    
    renderedLists.clear()
    listsListEl.innerHTML = '<li class="loading">One moment...</li>'
    
    const listsRef = ref(database, "lists")
    
    listsUnsubscribe = onValue(listsRef, (snapshot) => {
        // Always add Main List first
        if (!renderedLists.has(MAIN_LIST_ID)) {
            appendListToListsEl(MAIN_LIST_ID, MAIN_LIST_NAME, true)
        }

        let customListCount = 0
        
        if (snapshot.exists()) {
            const lists = snapshot.val()
            
            // Remove lists that no longer exist (except main)
            for (const [id, el] of renderedLists) {
                if (id !== MAIN_LIST_ID && !lists[id]) {
                    removeListWithAnimation(id, el)
                }
            }
            
            // Add new lists
            for (const [id, data] of Object.entries(lists)) {
                if (!renderedLists.has(id) && data.meta) {
                    appendListToListsEl(id, data.meta.name, false)
                    customListCount++
                } else if (data.meta) {
                    customListCount++
                }
            }
        }

        // Show/hide helper text
        if (customListCount === 0) {
            listsHelperEl.classList.remove("hidden")
        } else {
            listsHelperEl.classList.add("hidden")
        }
        
        // Clear loading message
        const loading = listsListEl.querySelector('.loading')
        if (loading) loading.remove()
        
    }, (error) => {
        console.error("Lists error:", error)
        listsListEl.innerHTML = '<li class="empty-state">Could not load lists</li>'
    })
}

function appendListToListsEl(id, name, isMain) {
    const loading = listsListEl.querySelector('.loading')
    if (loading) loading.remove()
    
    const li = document.createElement("li")
    li.dataset.id = id
    li.textContent = name
    
    if (isMain) {
        li.dataset.isMain = "true"
    }
    
    setupListTouchHandlers(li, id, name, isMain)
    
    li.classList.add("entering")
    
    // Main list always first
    if (isMain) {
        listsListEl.prepend(li)
    } else {
        listsListEl.append(li)
    }
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            li.classList.remove("entering")
        })
    })
    
    renderedLists.set(id, li)
}

function setupListTouchHandlers(li, id, name, isMain) {
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
        
        if (diffY > 10) {
            isScrolling = true
            li.style.transform = ""
            li.classList.remove("swiping")
            return
        }
        
        if (diffX > 10 && !isScrolling) {
            isSwiping = true
            li.classList.add("swiping")
            const translateX = Math.min(Math.max(-diffX, -100), 0)
            li.style.transform = `translateX(${translateX}px)`
        }
    }, { passive: true })
    
    li.addEventListener("touchend", async () => {
        touchHandled = true
        const diffX = touchStartX - touchCurrentX
        
        if (isScrolling) {
            return
        } else if (diffX > 80) {
            // Swipe to delete/clear
            li.style.transform = ""
            li.classList.remove("swiping")
            
            if (isMain) {
                const confirmed = await showConfirm(`Clear ${MAIN_LIST_NAME}?`)
                if (confirmed) {
                    clearMainList()
                }
            } else {
                const confirmed = await showConfirm(`Delete "${name}"?`)
                if (confirmed) {
                    deleteList(id, li)
                }
            }
        } else if (isSwiping) {
            li.style.transform = ""
            li.classList.remove("swiping")
        } else {
            // Tap to select
            selectList(id, true)
        }
    })
    
    li.addEventListener("click", (e) => {
        if (touchHandled) {
            touchHandled = false
            return
        }
        selectList(id, true)
    })
}

// Create list
createListButtonEl.addEventListener("click", createList)
listInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        createList()
        listInputEl.blur()
    }
})

function createList() {
    const name = listInputEl.value.trim()
    
    if (!name) {
        listInputEl.focus()
        return
    }
    
    const listsRef = ref(database, "lists")
    const newListRef = push(listsRef)
    
    set(newListRef, {
        meta: {
            name: name,
            createdAt: Date.now()
        }
    })
    
    listInputEl.value = ""
}

function deleteList(id, li) {
    li.style.transition = "transform 0.2s ease, opacity 0.2s ease"
    li.style.transform = "translateX(-100%)"
    li.style.opacity = "0"
    
    setTimeout(() => {
        const listRef = ref(database, `lists/${id}`)
        remove(listRef)
        renderedLists.delete(id)
        
        // If we deleted the current list, go back to main
        if (currentListId === id) {
            selectList(MAIN_LIST_ID, false)
        }
    }, 150)
}

function clearMainList() {
    const mainRef = ref(database, "shoppingList")
    remove(mainRef)
}

function removeListWithAnimation(id, li) {
    li.style.transition = "transform 0.2s ease, opacity 0.2s ease"
    li.style.transform = "translateX(-20px)"
    li.style.opacity = "0"
    
    setTimeout(() => {
        li.remove()
        renderedLists.delete(id)
    }, 200)
}

// ============ CONFIRMATION MODAL ============

function showConfirm(message) {
    return new Promise((resolve) => {
        confirmMessageEl.textContent = message
        confirmModalEl.classList.remove("hidden")
        confirmResolve = resolve
    })
}

confirmCancelEl.addEventListener("click", () => {
    confirmModalEl.classList.add("hidden")
    if (confirmResolve) {
        confirmResolve(false)
        confirmResolve = null
    }
})

confirmOkEl.addEventListener("click", () => {
    confirmModalEl.classList.add("hidden")
    if (confirmResolve) {
        confirmResolve(true)
        confirmResolve = null
    }
})

// Close modal on background click
confirmModalEl.addEventListener("click", (e) => {
    if (e.target === confirmModalEl) {
        confirmModalEl.classList.add("hidden")
        if (confirmResolve) {
            confirmResolve(false)
            confirmResolve = null
        }
    }
})

// ============ CLEANUP ============

function unsubscribeAll() {
    if (itemsUnsubscribe) {
        itemsUnsubscribe()
        itemsUnsubscribe = null
    }
    if (listsUnsubscribe) {
        listsUnsubscribe()
        listsUnsubscribe = null
    }
    renderedItems.clear()
    renderedLists.clear()
}
