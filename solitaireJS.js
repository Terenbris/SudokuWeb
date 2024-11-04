second = false;
first = "";
function Select(id) {
    if (second) {
        second = Second(id);
        return null;
    }
    else
    {
        second = First(id);
        return null;
    }
}

function First(id) {
    if (document.getElementById(id).className == "base") {
        return false;
    }
    first = id;
    document.getElementById(id).innerHTML = "<img src='sudoku.png'>First";
    return true;
}

function Second(id) {
    if (document.getElementById(first).contains(document.getElementById(id)) || document.getElementById(id).id == first) {
        console.log("Failure");
        return true;
    }
    prnt = document.getElementById(id).parentNode;
    insertChild = document.getElementById(first).nextSibling;
    while (document.getElementById(first).nextSibling != null) {
        prnt.appendChild(document.getElementById(first).nextSibling);
    }
    prnt.insertBefore(document.getElementById(first), insertChild);
    document.getElementById(id).innerHTML = "<img src='sudoku.png'>Second";
    first = "";
    return false;
}