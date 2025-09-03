import random
import time
import math
import datetime
import json
import requests

numbers = [1,2,3,4,5,6,7,8,9]
board = [[0 for col in range(9)] for row in range(9)]
finalBoard = [[0 for col in range(9)] for row in range(9)]
moreEasyBoards = []
easyBoards = []
mediumBoards = []
hardBoards = []
allBoards = []

def fillTable():
    global board
    time.sleep(2)
    random.seed(int(datetime.datetime.utcnow().timestamp()))
    board = [[0 for col in range(9)] for row in range(9)]
    tries = 0
    z = 0
    while z < 9:
        rep = True
        while rep:
            if tries == 1:
                print(z)
            rep = fillRow(z)
            if tries > 75:
                print("retry " + str(z))
                tries = 0
                time.sleep(2)
                random.seed(int(datetime.datetime.utcnow().timestamp()))
                board = [[0 for col in range(9)] for row in range(9)]
                z = 0
                #print(str(z))
            tries += 1
        z += 1

def fillRow(row):
    global board
    board[row] = [0,0,0,0,0,0,0,0,0]
    num = numbers[:]
    random.shuffle(num)
    for col in range(9):
        for z in num:
            if colCheck(z, col) and quadrantCheck(col,row,z):
                board[row][col] = z
                num.remove(z)
                break
    return 0 in board[row]

def quadrantCheck(col, row, num):
    x = math.floor(col/3)
    y = math.floor(row/3)
    errCount = 0
    for i in range(3):
        for j in range(3):
            if board[(y*3)+j][(x*3)+i] == num:
                errCount += 1
    return errCount == 0
                

def colCheck(num, col):
    errCount = 0
    for z in range(9):
        if board[z][col] == num:
            errCount += 1
    return errCount == 0

def createPuzzle(initCell = 25):
    global finalBoard
    finalBoard = [[0 for col in range(9)] for row in range(9)]
    initCellCor = [[9 for col in range(2)] for row in range(initCell)]
    intToStr = ["a","b","c","d","e","f","g","h","i"]
    for i in range(len(initCellCor)):
        rep = True
        while rep:
            x = random.randint(0,8)
            y = random.randint(0,8)
            if [x,y] not in initCellCor:
                rep = False
                initCellCor[i] = [x,y]
    
    for i in initCellCor:
        #print(str(i) + str(initCellCor.index(i)+1))
        finalBoard[i[0]][i[1]] = intToStr[board[i[0]][i[1]]-1]
        #finalBoard[i[0]][i[1]] = board[i[0]][i[1]]
    
    print("Board" + str(finalBoard))

def getAPIBoard(difficulty):
    body = {
        "difficulty": difficulty,
        "solution": True,
        "array": False
    }
    headers = {"Content-Type": "application/json"}
    response = requests.post("https://you-do-sudoku-api.vercel.app/api", json=body, headers=headers)
    data = response.json()
    board_string = data.get("puzzle", "")
    int_to_char = {str(i): chr(96 + i) for i in range(1, 10)}
    board_2d = []
    for i in range(9):
        row = []
        for j in range(9):
            val = board_string[i * 9 + j]
            if val in int_to_char:
                row.append(int_to_char[val])
            else:
                row.append('0')
        board_2d.append(row)
    return board_2d

def compilePuzzles():
    for i in range(10):#easy boards
        easyBoards.append(getAPIBoard("easy"))
    for i in range(10):#medium boards
        mediumBoards.append(getAPIBoard("easy"))
    for i in range(10):#hard boards
        hardBoards.append(getAPIBoard("easy"))
    allBoards.append(easyBoards)
    allBoards.append(mediumBoards)
    allBoards.append(hardBoards)

def writeFile():
    json_string = json.dumps(allBoards)
    f = open("boardsAPI.txt", "w")
    f.write(json_string)
    f.close()

def main():
    compilePuzzles()
    writeFile()
    print(board)
    
main()
