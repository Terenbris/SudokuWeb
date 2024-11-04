second = false;
first = "";
pId = "";
function Select(id) {
    if (second) {
        second = false;
        Second(id);
        return null;
    }
    second = true;
    first = id;
    pId = document.getElementById(id).parentElement.id;
    document.getElementById(id).innerHTML += "First";
}

function Second(id) {
    document.getElementById(id).parentElement.appendChild(document.getElementById(first));
    document.getElementById(pId).removeChild(document.getElementById(first));
    document.getElementById(id).innerHTML += "Second";
}