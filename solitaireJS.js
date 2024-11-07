secondVar = false;
firstVar = "";
deck = [];
function select(id) {
    if (secondVar) {
        secondVar = second(id);
        return null;
    }
    else
    {
        secondVar = first(id);
        return null;
    }
}

function first(id) {
    if (document.getElementById(id).className == "base") {
        return false;
    }
    firstVar = id;
    return true;
}

function second(id) {
    if (document.getElementById(firstVar).contains(document.getElementById(id)) || document.getElementById(id).id == firstVar) {
        console.log("Failure");
        return true;
    }
    prnt = document.getElementById(id).parentNode;
    insertChild = document.getElementById(firstVar).nextSibling;
    while (document.getElementById(firstVar).nextSibling != null) {
        prnt.appendChild(document.getElementById(firstVar).nextSibling);
    }
    prnt.insertBefore(document.getElementById(firstVar), insertChild);
    firstVar = "";
    return false;
}

function init() {
    createDeck();
    load();
    document.getElementById("testVal").innerHTML = deck;
}

function load() {
    cardDeck = shuffle(deck);
    for (i = 1; i < 8; i++) {
        card = "<div class='boardCard' id='" + cardDeck[i] + "' onclick='select(\""+cardDeck[i]+"\")'><img src='./PNG-cards-1.3/"+cardDeck[i]+".png'></div>";
        document.getElementById("col"+i).innerHTML += card;
    }
}

function createDeck() {
    suits = ["hearts","diamonds","spades","clubs"]
    for (j = 0; j < 4; j++) {
        for (i = 1; i < 14; i++) {
            card = i;
            if(i==11) {
                card = "jack";
            }
            else if (i == 12) {
                card = "queen";
            }
            else if (i == 13) {
                card = "king";
            }
            else if (i == 1) {
                card = "ace";
            }
            deck.push(card+"_of_"+suits[j]);
        }
    }
}

const shuffle = (array) => { 
    for (let i = array.length - 1; i > 0; i--) { 
      const j = Math.floor(Math.random() * (i + 1)); 
      [array[i], array[j]] = [array[j], array[i]]; 
    } 
    return array; 
  }; 