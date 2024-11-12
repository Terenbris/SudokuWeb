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
    prevSib = document.getElementById(firstVar).previousSibling;
    console.log(document.getElementById(firstVar).previousSibling);
    //reveal card once card on top removed
    if (prevSib.id != undefined && prevSib.className != "base") {
        prevSib.innerHTML = "<img src='./PNG-cards-1.3/"+prevSib.id+".png'></img>"
    }
    prnt = document.getElementById(id).parentNode;
    insertChild = document.getElementById(firstVar).nextSibling;
    while (insertChild != null) {
        prnt.appendChild(insertChild);
    }
    prnt.insertBefore(document.getElementById(firstVar), insertChild);
    firstVar = "";
    return false;
}

function init() {
    createDeck();
    load();
    //document.getElementById("testVal").innerHTML = deck;
}

function load() {
    for (i = 1; i < 8; i++) {
        base = "<div class='base' id='base" + i + "' onclick='select(\"base"+i+"\")'><img src='./PNG-cards-1.3/black_joker.png'></div>";
            document.getElementById("col"+(i)).innerHTML += base;
    }
    cardDeck = shuffle(deck);
    for (j = 0; j < 7; j++) {
        for (i = j; i < 7; i++) {
            img = cardDeck[0];
            if (i != j) {
                img = "black_joker";
            }
            card = "<div class='boardCard' id='" + cardDeck[0] + "' onclick='select(\""+cardDeck[0]+"\")'><img src='./PNG-cards-1.3/"+img+".png'></div>";
            document.getElementById("col"+(i+1)).innerHTML += card;
            cardDeck.shift();
        }
        console.log(cardDeck);
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