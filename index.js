import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, update, set, get } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"

const appSettings = {
    databaseURL: "https://realtime-database-b9772-default-rtdb.firebaseio.com/"
}

// Initialize Firebase
const app = initializeApp(appSettings)
const database = getDatabase(app)

// Database references
const listsInDB = ref(database, "lists")
let currentListId = null
let currentShoppingListRef = null

// Get DOM elements
// Shopping screen elements
const shoppingScreenEl = document.getElementById("shopping-screen")
const inputFieldEl = document.getElementById("input-field")
const addButtonEl = document.getElementById("add-button")
const shoppingListEl = document.getElementById("shopping-list")
const listsButtonEl = document.getElementById("lists-button")

// Lists screen elements
const listsScreenEl = document.getElementById("lists-screen")
const listNameFieldEl = document.getElementById("list-name-field")
const newListButtonEl = document.getElementById("new-list-button")
const backToShoppingButtonEl = document.getElementById("back-to-shopping-button")
const listsContainerEl = document.getElementById("lists-container")

// Confirmation dialog elements
const confirmationDialogEl = document.getElementById("confirmation-dialog")
const confirmDeleteButtonEl = document.getElementById("confirm-delete-button")
const cancelDeleteButtonEl = document.getElementById("cancel-delete-button")

// Variables for tracking tap events
let lastTapTime = 0
let deleteListId = null

// Screen navigation functions
function showShoppingScreen() {
    shoppingScreenEl.style.display = "flex"
    listsScreenEl.style.display = "none"
}

function showListsScreen() {
    shoppingScreenEl.style.display = "none"
    listsScreenEl.style.display = "flex"
}

// Initialize app
function init() {
    // Retrieve the last used list from localStorage or create a default list
    const lastUsedListId = localStorage.getItem("lastUsedListId")
    
    if (lastUsedListId) {
        // Check if the last used list still exists
        get(ref(database, `lists/${lastUsedListId}`)).then((snapshot) => {
            if (snapshot.exists()) {
                // Load the last used list
                loadList(lastUsedListId)
            } else {
                // Create a default list if the last used list doesn't exist anymore
                createNewList("My Shopping List")
            }
        }).catch(() => {
            // Create a default list if error
            createNewList("My Shopping List")
        })
    } else {
        // Create a default list if no list exists
        createNewList("My Shopping List")
    }
    
    // Load all lists for the lists screen
    loadLists()
}

// Create a new shopping list
function createNewList(listName) {
    const currentDate = new Date()
    const dateString = currentDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
    
    // If list name is empty, use the current date
    if (!listName) {
        listName = "List - " + dateString
    }
    
    // Create list in database
    const newListRef = push(listsInDB)
    set(newListRef, {
        name: listName,
        createdAt: dateString,
        items: {}
    }).then(() => {
        // Set as current list
        currentListId = newListRef.key
        currentShoppingListRef = ref(database, `lists/${currentListId}/items`)
        
        // Save to localStorage
        localStorage.setItem("lastUsedListId", currentListId)
        
        // Update UI
        updateListTitle(listName)
        
        // Show shopping screen
        showShoppingScreen()
        
        // Clear input
        listNameFieldEl.value = ""
    })
}

// Load a specific list
function loadList(listId) {
    // Set current list
    currentListId = listId
    currentShoppingListRef = ref(database, `lists/${listId}/items`)
    
    // Save to localStorage
    localStorage.setItem("lastUsedListId", listId)
    
    // Get list name
    get(ref(database, `lists/${listId}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const listData = snapshot.val()
            updateListTitle(listData.name)
        }
    })
    
    // Load items from the list
    onValue(currentShoppingListRef, (snapshot) => {
        if (snapshot.exists()) {
            let itemsArray = Object.entries(snapshot.val())
            
            clearShoppingListEl()
            
            for (let i = 0; i < itemsArray.length; i++) {
                appendItemToShoppingListEl(itemsArray[i])
            }
        } else {
            shoppingListEl.innerHTML = "No items here... yet"
        }
    })
    
    // Show shopping screen
    showShoppingScreen()
}

// Update the title display
function updateListTitle(listName) {
    // For now we're just updating the document title
    document.title = `${listName} - Shopping List`
}

// Load all lists for the lists screen
function loadLists() {
    onValue(listsInDB, (snapshot) => {
        if (snapshot.exists()) {
            let listsArray = Object.entries(snapshot.val())
            
            clearListsContainerEl()
            
            for (let i = 0; i < listsArray.length; i++) {
                appendListToListsContainerEl(listsArray[i])
            }
        } else {
            listsContainerEl.innerHTML = "No lists here... yet"
        }
    })
}

// Delete a list with confirmation
function deleteList(listId) {
    // Set the list ID to delete
    deleteListId = listId
    
    // Show confirmation dialog
    confirmationDialogEl.style.display = "flex"
}

// Add an item to the shopping list
function addItemToList(itemName) {
    if (itemName && currentShoppingListRef) {
        push(currentShoppingListRef, {
            name: itemName,
            completed: false,
            addedAt: new Date().toISOString()
        })
    }
}

// Toggle item completed status
function toggleItemCompletedStatus(itemId, currentStatus) {
    if (currentShoppingListRef) {
        const itemRef = ref(database, `lists/${currentListId}/items/${itemId}`)
        update(itemRef, {
            completed: !currentStatus
        })
    }
}

// Remove an item from the shopping list
function removeItem(itemId) {
    if (currentShoppingListRef) {
        const itemRef = ref(database, `lists/${currentListId}/items/${itemId}`)
        remove(itemRef)
    }
}

// Utility functions for DOM manipulation
function clearShoppingListEl() {
    shoppingListEl.innerHTML = ""
}

function clearListsContainerEl() {
    listsContainerEl.innerHTML = ""
}

function appendItemToShoppingListEl(item) {
    const itemId = item[0]
    const itemData = item[1]
    
    const newEl = document.createElement("li")
    newEl.textContent = itemData.name
    newEl.style.touchAction = "manipulation" // Prevent zoom on double tap
    
    // Set completed class if item is completed
    if (itemData.completed) {
        newEl.classList.add("completed")
    }
    
    // Track taps for single vs double click behavior
    let tapTimeout
    
    newEl.addEventListener("click", function(e) {
        const currentTime = new Date().getTime()
        const timeSinceLastTap = currentTime - lastTapTime
        
        if (timeSinceLastTap < 300) {
            // Double tap detected - remove item
            clearTimeout(tapTimeout)
            removeItem(itemId)
        } else {
            // Single tap - toggle completed status after a short delay
            tapTimeout = setTimeout(() => {
                toggleItemCompletedStatus(itemId, itemData.completed)
            }, 300)
        }
        
        lastTapTime = currentTime
    })
    
    shoppingListEl.append(newEl)
}

function appendListToListsContainerEl(list) {
    const listId = list[0]
    const listData = list[1]
    
    const newEl = document.createElement("li")
    newEl.style.touchAction = "manipulation" // Prevent zoom on double tap
    
    // Create list info container
    const listInfoDiv = document.createElement("div")
    listInfoDiv.className = "list-info"
    
    // Create list name element
    const listNameEl = document.createElement("span")
    listNameEl.className = "list-name"
    listNameEl.textContent = listData.name
    
    // Create list date element
    const listDateEl = document.createElement("span")
    listDateEl.className = "list-date"
    listDateEl.textContent = listData.createdAt
    
    // Add name and date to info container
    listInfoDiv.appendChild(listNameEl)
    listInfoDiv.appendChild(listDateEl)
    
    // Create item count badge
    const itemCountEl = document.createElement("span")
    itemCountEl.className = "item-count"
    
    // Count items if they exist
    let itemCount = 0
    if (listData.items) {
        itemCount = Object.keys(listData.items).length
    }
    itemCountEl.textContent = itemCount
    
    // Add elements to list item
    newEl.appendChild(listInfoDiv)
    newEl.appendChild(itemCountEl)
    
    // Track taps for single vs double click behavior
    let tapTimeout
    
    newEl.addEventListener("click", function() {
        const currentTime = new Date().getTime()
        const timeSinceLastTap = currentTime - lastTapTime
        
        if (timeSinceLastTap < 300) {
            // Double tap detected - show delete confirmation
            clearTimeout(tapTimeout)
            deleteList(listId)
        } else {
            // Single tap - load list
            tapTimeout = setTimeout(() => {
                loadList(listId)
            }, 300)
        }
        
        lastTapTime = currentTime
    })
    
    listsContainerEl.append(newEl)
}

// Event listeners
addButtonEl.addEventListener("click", function() {
    const inputValue = inputFieldEl.value
    if (inputValue) {
        addItemToList(inputValue)
        inputFieldEl.value = ""
    }
})

listsButtonEl.addEventListener("click", function() {
    showListsScreen()
})

newListButtonEl.addEventListener("click", function() {
    const listName = listNameFieldEl.value
    createNewList(listName)
})

backToShoppingButtonEl.addEventListener("click", function() {
    showShoppingScreen()
})

confirmDeleteButtonEl.addEventListener("click", function() {
    if (deleteListId) {
        // Handle if the deleted list is the current list
        if (deleteListId === currentListId) {
            currentListId = null
            localStorage.removeItem("lastUsedListId")
        }
        
        // Remove the list from the database
        const listRef = ref(database, `lists/${deleteListId}`)
        remove(listRef)
        
        // Hide confirmation dialog
        confirmationDialogEl.style.display = "none"
        deleteListId = null
        
        // If current list was deleted, create or load another list
        if (!currentListId) {
            // Try to load the first available list or create a new one
            get(listsInDB).then((snapshot) => {
                if (snapshot.exists()) {
                    const listsArray = Object.entries(snapshot.val())
                    if (listsArray.length > 0) {
                        loadList(listsArray[0][0])
                    } else {
                        createNewList("My Shopping List")
                    }
                } else {
                    createNewList("My Shopping List")
                }
            })
        }
    }
})

cancelDeleteButtonEl.addEventListener("click", function() {
    // Hide confirmation dialog
    confirmationDialogEl.style.display = "none"
    deleteListId = null
})

// Input field enter key support
inputFieldEl.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        const inputValue = inputFieldEl.value
        if (inputValue) {
            addItemToList(inputValue)
            inputFieldEl.value = ""
        }
    }
})

listNameFieldEl.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        const listName = listNameFieldEl.value
        createNewList(listName)
    }
})

// Initialize the app
init()
