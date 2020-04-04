const fs = require('fs');

module.exports = function(app, passport, check, validationResult) {
    app.get('/', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/game');
        } else {
            res.render('home', {
                is_authenticated: false,
            });
        }
    });

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/signup', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('game');
        } else {
            res.render('signup', {
                is_authenticated: false,
            });
        }
    });

    app.post(
        '/signup',
        [
            check('password')
                .isLength({ min: 6 })
                .custom((value, { req, loc, path }) => {
                    if (value !== req.body.passwordconfirmation) {
                        // throw error if passwords do not match
                        throw new Error("Passwords don't match");
                    } else {
                        return value;
                    }
                }),
            check('email')
                .isEmail()
                .normalizeEmail()
                .withMessage('Please enter a valid email'),
        ],
        (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                errors.array().forEach(error => {
                    req.flash('error', error.msg);
                });
                res.redirect('signup');
            } else {
                passport.authenticate('local-signup', {
                    successRedirect: 'game', // redirect to the secure profile section
                    failureRedirect: 'signup', // redirect back to the signup page if there is an error
                    failureFlash: true, // allow flash messages
                })(req, res);
            }
        }
    );

    app.get('/login', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/game');
        } else {
            res.render('login', {
                is_authenticated: false,
            });
        }
    });

    app.post(
        // Add validation
        '/login',
        passport.authenticate('local-login', {
            successRedirect: 'game', // redirect to the secure profile section
            failureRedirect: 'login', // redirect back to the signup page if there is an error
            failureFlash: true, // allow flash messages
        })
    );

    app.get('/game', (req, res) => {
        const io = req.app.get('socketio');

        if (req.isAuthenticated()) {
            res.render('game', {
                is_authenticated: true,
                userid: req.user.userid,
            });

            io.sockets.on('connection', function(socket) {
                let player;
                const totalConnections = io.engine.clientsCount;
                const { userid } = req.user;
                const clientid = socket.id;
                const name = req.user.email.split('@')[0];
                let players;

                socket.on('register', function() {
                    if (name !== null) {
                        fs.readFile('active-players.json', (err, data) => {
                            if (err) throw err;

                            data = data.toString();

                            if (data !== '') {
                                players = data;
                                const playersarray = players.split(',');
                                playersarray.pop();
                                const checkPlayers = players.split('|');
                                console.log(playersarray);
                                if (playersarray.length > 3) {
                                    startGame(io, checkPlayers, name);
                                }
                                if (!checkPlayers.includes(`${name}`)) {
                                    players += `${name}|${clientid},`;
                                    fs.writeFile('active-players.json', players, err => {
                                        if (err) throw err;
                                    });
                                }
                                io.emit('joined', `${players}`);
                            } else {
                                fs.writeFile('active-players.json', `${name}|${clientid},`, err => {
                                    if (err) throw err;
                                });
                                io.emit('joined', `${name}`);
                            }
                        });
                    }
                });

                socket.on('disconnect', function(userId) {
                    io.emit('left', `${userId}`);
                });
            });
        } else {
            res.redirect('/login');
        }
    });

    const suits = ['spades', 'diamonds', 'clubs', 'hearts'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    function startGame(io, players, name) {
        io.emit('gameupdate', 'game is starting');
        const deck = getDeck();
        const playerOneCards = dealDeck(deck);
        const playerTwoCards = dealDeck(deck);
        const playerThreeCards = dealDeck(deck);
        const playerFourCards = dealDeck(deck);
        console.log(playerOneCards);
        io.emit('playercards', `Your cards are: ${JSON.stringify(playerOneCards)}`);
    }

    function getDeck() {
        const deck = new Array();

        for (let i = 0; i < suits.length; i++) {
            for (let x = 0; x < values.length; x++) {
                const card = { Value: values[x], Suit: suits[i] };
                deck.push(card);
            }
        }
        return deck;
    }

    function dealDeck(deck) {
        const location1 = Math.floor(Math.random() * deck.length);
        const location2 = Math.floor(Math.random() * deck.length);
        const cards = [];
        cards.push(deck[location1]);
        cards.push(deck[location2]);
        deck.slice(deck[location1]);
        deck.slice(deck[location2]);
        return cards;
    }
};
