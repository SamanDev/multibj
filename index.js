// Websocket server
const { log } = require("console");
const express = require("express");
const { url } = require("inspector");
const { setTimeout } = require("timers");
const axios = require("axios").create({ baseUrl: "http://127.0.0.1:8081" });

const app = express();
const server = require("http").createServer(app);
const PORT = process.env.PORT || 8080;
const WebSocket = require("ws");
const WEB_URL = process.env.NODE_ENV === "production" ? `https://${process.env.DOMAIN_NAME}/` : `http://localhost:${PORT}/`;
const WEB_URL3 = process.env.NODE_ENV === "production" ? `https://mbj.wheelofpersia.com/` : `https://mbj.wheelofpersia.com/`;

const wss = new WebSocket.Server({ server: server });

const suit = ["Heart", "Diamond", "Spade", "Club"];
// Cards (values)
const values = [
    {
        card: "A",
        value: [1, 11],
        hasAce: true,
    },
    {
        card: "2",
        value: 2,
    },
    {
        card: "3",
        value: 3,
    },
    {
        card: "4",
        value: 4,
    },
    {
        card: "5",
        value: 5,
    },
    {
        card: "6",
        value: 6,
    },
    {
        card: "7",
        value: 7,
    },
    {
        card: "8",
        value: 8,
    },
    {
        card: "9",
        value: 9,
    },
    {
        card: "10",
        value: 10,
    },
    {
        card: "J",
        value: 10,
    },
    {
        card: "Q",
        value: 10,
    },
    {
        card: "K",
        value: 10,
    },
];
let deck = [];
function getDeck() {
    // Loop through suite AND values
    for (let s = 0; s < suit.length; s++) {
        for (let v = 0; v < values.length; v++) {
            let card = { suit: suit[s], value: values[v] };
            deck.push(card);
        }
    }
    for (let s = 0; s < suit.length; s++) {
        for (let v = 0; v < values.length; v++) {
            let card = { suit: suit[s], value: values[v] };
            deck.push(card);
        }
    }
    for (let s = 0; s < suit.length; s++) {
        for (let v = 0; v < values.length; v++) {
            let card = { suit: suit[s], value: values[v] };
            deck.push(card);
        }
    }
    shuffle(deck);
}
const cacheDuration = 1000 * 60 * 60 * 24 * 365; // 1 year
const guid = () => {
    const s4 = () =>
        Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
};
var idcode = guid();

// Serve all the static files, (ex. index.html app.js style.css)
app.use(
    express.static("public", {
        maxAge: cacheDuration,
        setHeaders: (res, path) => {
            // Set caching headers
            res.setHeader("Cache-Control", `public, max-age=${cacheDuration}`);
            res.setHeader("Expires", new Date(Date.now() + cacheDuration).toUTCString());
        },
    })
);

server.listen(PORT, () => console.log(`Listening on ${process.env.PORT} or 8080`));

// hashmap clients
const clients = {};
const games = [];
const players = {};
const spectators = {};

let gameOn = null;
let gameStart = null;

const createSeats = (seats) => {
    var _seats = [];
    for (let i = 0; i < seats; i++) {
        _seats.push({});
    }
    return _seats;
};

const createTable = (gameId, min, seats) => {
    games.push({
        id: gameId,
        players: createSeats(seats),

        dealer: {
            cards: [],

            sum: null,
            hasAce: false,
            hasLeft: null,
        },
        gameOn: gameOn,
        gameStart: gameStart,
        currentPlayer: 10,
        min: min,
        seats: seats,
        startTimer: -1,
        timer: null,
    });
};

function shuffle(deck) {
    // Shuffle by 2 random locations 1000 times
    for (let i = 0; i < 1000; i++) {
        let location1 = Math.floor(Math.random() * deck.length);
        let location2 = Math.floor(Math.random() * deck.length);
        let tmp = deck[location1];

        deck[location1] = deck[location2];
        deck[location2] = tmp;
    }
}
createTable("BJ01", 1, 7);
createTable("BJ02", 100, 6);
createTable("BJ03", 200, 5);
createTable("BJ04", 500, 4);

function updateCurrentPlayer(gameId, curNow) {
    //console.log(gameId, curNow);

    const game = games.filter((game) => game.id === gameId)[0];
    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet && playNum >= curNow && game.currentPlayer == curNow && game.players[playNum]?.sum < 21) {
            game.currentPlayer = playNum;
        }
    });

    if (game.currentPlayer == curNow) {
        // PUSH DEALER TO PLAYER ARRAY
        // players.push(dealer);
        game.currentPlayer = curNow + 1;
        outputCardSumDealer(gameId);
    }

    const payLoad = {
        method: "tables",
        games: games,
    };
    sendToAll(payLoad);
}
function outputCardSumDealer(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    if (game.dealer.sum < 17) {
        addCardDealer(gameId, 800, true);
    } else {
        winLoseComponents(gameId);
    }
}
function sendToAll(payLoad) {
    for (var prop in clients) {
        if (clients.hasOwnProperty(prop)) {
            if (clients[prop]?.ws) {
                clients[prop].ws.send(JSON.stringify(payLoad));
            }
        }
    }
}

function startBetTimer(gameId, blnStart) {
    const game = games.filter((game) => game.id === gameId)[0];

    if (blnStart) {
        game.startTimer = 9;
    } else {
        game.startTimer = game.startTimer - 1;
    }

    const payLoad = {
        method: "tables",
        games: games,
    };
    sendToAll(payLoad);

    if (game.startTimer > -1) {
        setTimeout(() => startBetTimer(gameId, false), 1000);
    } else {
        startDeal(gameId);
        const players = game.players;

        var data = { gameName: "BlackjackMulti", data: [], id: idcode };
        players.forEach((c) => {
            data.data.push({ username: c.nickname, bet1: c.bet });
        });
        const _dec = changeBalance("gamesStartGame", data);
    }
}
function startTableTimer(gameId, seat, blnStart) {
    const game = games.filter((game) => game.id === gameId)[0];
    //console.log(game.currentPlayer);

    if (game.currentPlayer == 10 || game.dealer.cards.length > 1) {
        return false;
    }
    if (blnStart) {
        game.timer = 19;
    } else {
        game.timer = game.timer - 1;
    }

    const payLoad = {
        method: "tables",
        games: games,
    };
    sendToAll(payLoad);

    if (game.timer > -1) {
        if (game.currentPlayer != seat) {
            game.timer = 10;
            startTableTimer(gameId, game.currentPlayer, true);
        } else {
            setTimeout(() => startTableTimer(gameId, seat, false), 1000);
        }
    } else {
        updateCurrentPlayer(gameId, seat);
        setTimeout(() => startTableTimer(gameId, game.currentPlayer, true), 1000);
    }
}
function startDeal(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    getDeck();
    var leftCard = 0;
    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet) {
            leftCard = leftCard + 1;
            addCard(gameId, playNum, leftCard * 250);
        } else {
            game.players[playNum] = {};
        }
    });
    leftCard = leftCard + 1;
    //addCardDealer(gameId, leftCard * 250);
    leftCard = leftCard + 1;
    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet) {
            leftCard = leftCard + 1;
            addCard(gameId, playNum, leftCard * 250);
        } else {
            game.players[playNum] = {};
        }
    });
    leftCard = leftCard + 1;

    addCardDealer(gameId, leftCard * 250);
}
function addCard(gameId, playNum, timeout) {
    setTimeout(() => {
        const game = games.filter((game) => game.id === gameId)[0];
        game.players[playNum].cards.push(deck[0]);
        deck.shift();
        updateSumDeal(gameId);

        if (game.players[playNum].sum == 21 && game.players[playNum].cards.length == 2) {
            game.players[playNum].blackjack = true;
            updateCurrentPlayer(gameId, playNum);
        }
        if (game.players[playNum].sum >= 21 || game.players[playNum].isDouble) {
            updateCurrentPlayer(gameId, playNum);
        }

        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    }, timeout);
}
function addCardDealer(gameId, timeout, compare) {
    setTimeout(() => {
        const game = games.filter((game) => game.id === gameId)[0];
        game.dealer.cards.push(deck[0]);
        deck.shift();
        updateSumDeal(gameId);
        if (game.dealer.cards.length == 1) {
            game.gameOn = true;
        }
        if (game.dealer.sum == 21 && game.dealer.cards.length == 2) {
            game.dealer.blackjack = true;
            winLoseComponents(gameId);
        }
        if (game.dealer.sum >= 17) {
            winLoseComponents(gameId);
        }
        if (game.dealer.sum < 17 && compare) {
            addCardDealer(gameId, timeout, compare);
        }

        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
        startTableTimer(gameId, game.currentPlayer, true);
    }, timeout);
}
function winLoseComponents(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet && game.players[playNum]?.sum <= 21) {
            if (game.dealer.sum > 21) {
                if (game.players[playNum].blackjack) {
                    game.players[playNum].win = 1.5 * game.players[playNum].bet + game.players[playNum].bet;
                } else {
                    game.players[playNum].win = game.players[playNum].bet * 2;
                }
            } else {
                if (game.dealer.sum < game.players[playNum]?.sum) {
                    if (game.players[playNum].blackjack) {
                        game.players[playNum].win = 1.5 * game.players[playNum].bet + game.players[playNum].bet;
                    } else {
                        game.players[playNum].win = game.players[playNum].bet * 2;
                    }
                }
                if (game.dealer.sum == game.players[playNum]?.sum) {
                    game.players[playNum].win = game.players[playNum].bet;
                }
            }
        }
    });
    var data = { gameName: "BlackjackMulti", data: [], id: idcode };
    game.players.forEach((c) => {
        if (c.win && c.win > 0) {
            data.data.push({ username: c.nickname, bet1: c.win });
        }
    });
    changeBalance("gamesEndGame", data);
    setTimeout(() => {
        game.players.map(function (player, playNum) {
            if (game.players[playNum]?.bet) {
                game.players[playNum].bet = 0;
                game.players[playNum].win = 0;
                game.players[playNum].blackjack = false;

                game.players[playNum].isDouble = false;

                game.players[playNum].sum = 0;
                game.players[playNum].cards = [];
            }
        });
        game.dealer = {
            cards: [],
            hiddenCard: [],
            sum: null,
            hasAce: false,
            hasLeft: null,
        };
        game.gameOn = false;
        game.gameStart = false;
        game.currentPlayer = 10;

        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    }, 7000);
}
function updateSumDeal(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    game.players.map(function (player, playNum) {
        var _sum = 0;
        var haveAce = false;

        if (player.bet && player?.cards) {
            game.players[playNum].cards.map(function (card) {
                var _val = card.value.value;
                if (typeof _val === "object" && _val !== null) {
                    haveAce = true;
                    _val = _val[0];
                }
                _sum = _sum + _val;
            });
            if (haveAce) {
                if (_sum + 10 <= 21) {
                    _sum = _sum + 10;
                }
            }
            game.players[playNum].sum = _sum;
        }
    });
    var _sum = 0;
    var haveAce = false;
    if (game.dealer?.cards) {
        game.dealer.cards.map(function (card) {
            var _val = card.value.value;
            if (typeof _val === "object" && _val !== null) {
                haveAce = true;
                _val = _val[0];
            }
            _sum = _sum + _val;
        });
        if (haveAce) {
            if (_sum + 10 <= 21) {
                _sum = _sum + 10;
            }
        }
        game.dealer.sum = _sum;
    }
}
wss.on("connection", (ws) => {
    // wsServer || wss AND request || connection
    // Someone trying to connect
    // const connection = connection.accept(null, connection.origin);

    ws.on("close", () => {
        // connection || wss
        console.log("closed");
    });

    ws.on("message", (message) => {
        // connection || wss
        const result = JSON.parse(message);

        // a user want to create a new game

        if (result.method === "join") {
            const gameId = result.gameId;
            const seat = result.seat;
            const theClient = result.theClient;
            const game = games.filter((game) => game.id === gameId)[0];

            if (!game.players[seat]?.nickname) {
                game.players[seat] = theClient;

                const payLoad = {
                    method: "tables",
                    games: games,
                };
                sendToAll(payLoad);
            }
        }
        if (result.method === "bet") {
            const gameId = result.gameId;
            const seat = result.seat;
            const amount = result.amount;
            const game = games.filter((game) => game.id === gameId)[0];
            if (game.players[seat].bet == 0) {
                game.players[seat].bet = amount;
                game.players[seat].balance = game.players[seat].balance - amount;
                theClient.balance = game.players[seat].balance;

                const userPayload = {
                    method: "connect",
                    theClient: theClient,
                };
                ws.send(JSON.stringify(userPayload));
                if (game.currentPlayer > seat) {
                    game.currentPlayer = seat;
                }
                const payLoad = {
                    method: "tables",
                    games: games,
                };
                sendToAll(payLoad);
            }

            if (!game.gameStart) {
                game.gameStart = true;
                startBetTimer(gameId, true);
            }
        }
        if (result.method === "hit") {
            const gameId = result.gameId;
            const seat = result.seat;

            const game = games.filter((game) => game.id === gameId)[0];

            addCard(gameId, seat, 0);
        }
        if (result.method === "double") {
            const gameId = result.gameId;
            const seat = result.seat;

            const game = games.filter((game) => game.id === gameId)[0];
            var data = { gameName: "BlackjackMulti", data: [], id: idcode };
            
                data.data.push({ username:game.players[seat].nickname, bet1: game.players[seat].bet });
            
            changeBalance("gamesStartGame", data);
            game.players[seat].bet = game.players[seat].bet * 2;
            game.players[seat].isDouble = true;
            addCard(gameId, seat, 0);
        }
        if (result.method === "stand") {
            const gameId = result.gameId;
            const seat = result.seat;

            updateCurrentPlayer(gameId, seat);
        }
        if (result.method === "leave") {
            const gameId = result.gameId;
            const seat = result.seat;

            const game = games.filter((game) => game.id === gameId)[0];

            game.players[seat] = {};

            const payLoad = {
                method: "tables",
                games: games,
            };
            sendToAll(payLoad);
        }
        if (result.method === "finalbet") {
        }

        if (result.method === "setNewBalance") {
            const theClient = result.theClient;
            const players = result.players;
            const spectators = result.spectators;

            const payLoad = {
                method: "setuser",
                players: players,
                theClient: theClient,
            };
            clients[clientId].ws.send(JSON.stringify(payLoad));
        }

        if (result.method === "resetGameState") {
            const spectators = result.spectators;
            const gameId = result.gameId;
            const game = games.filter((game) => game.id === gameId);
            const players = result.players;
            game.players = players;

            const payLoad = {
                method: "resetGameState",
                game: game,
            };
            var data = { gameName: "BlackjackMulti", data: [], id: idcode };
            players.forEach((c) => {
                if (c.win && c.win > 0) {
                    data.data.push({ username: c.nickname, bet1: c.win });
                }
            });
            spectators.forEach((c) => {
                clients[c.clientId].ws.send(JSON.stringify(payLoad));
            });
            const _inc = changeBalance("gamesEndGame", data);
        }
    });
    // The ClientId
    var _token = ws._protocol;
    const clientId = _token;
    // The Client
    clients[clientId] = {
        ws: ws,
    };

    // The client object
    let theClient = {
        nickname: "",
        avatar: "",
        cards: [],
        bet: 0,
        balance: 5000,
        sum: null,
        hasAce: false,
        isReady: false,
        blackjack: false,
        isDouble: false,
        hasLeft: false,
        win: 0,
    };
    let player = null;
    // The players Array

    players[theClient] = {
        ws: ws,
    };
    players[player] = {
        ws: ws,
    };
    // The spectator Array
    spectators[theClient] = {
        ws: ws,
    };

    // Send this to client

    getUser(_token, clientId, theClient, ws);

    // Send the payLoad to the client
});

const getUser = async (token, clientId, theClient, ws) => {
    var data = await getUserService(token).then((userdata) => {
        theClient.balance = userdata.balance;
        theClient.nickname = userdata.username;
        theClient.avatar = "lvl" + userdata.level;

        const userLoad = {
            method: "connect",
            clientId: clientId,
            theClient: theClient,
        };
        //console.log(payLoad);
        ws.send(JSON.stringify(userLoad));
        const payLoad = {
            method: "tables",
            games: games,
        };

        ws.send(JSON.stringify(payLoad));
    });
};
const changeBalance = async (com, data) => {
    //console.log(com);
    const userdata = await getChipService(com, data);

    if (com == "gamesEndGame") {
        idcode = guid();
    }
    //console.log(userdata);
};

const getUserService = (token) => {
    return axios({
        url2: "http://127.0.0.1:8081/api/req/gamesGetUser",
        url: "https://api.glxypkr.com/api/req/gamesGetUser",
        method: "get",
        headers: {
            Authorization: token ? `LooLe  ${token}` : null,
        },
    })
        .then((response) => {
            return response.data;
        })
        .catch((err) => {
            return err;
        });
};
const getChipService = (com, data) => {
    return axios({
        url2: "http://127.0.0.1:8081/api/req/nodeService/" + com,
        url: "https://api.glxypkr.com/api/req/nodeService/" + com,
        method: "post",

        data,
    })
        .then((response) => {
            //console.log(response.data);
            return response.data;
        })
        .catch((err) => {
            return err;
        });
};
// Generates unique guid (i.e. unique user ID)

// Random Part ID
function partyId() {
    var result = "";
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
