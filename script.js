// script.js

// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDlQOPP_B_1XJi6vHlwxzcChp5gfXJtUag",
  authDomain: "mafia-102cc.firebaseapp.com",
  projectId: "mafia-102cc",
  storageBucket: "mafia-102cc.firebasestorage.app",
  messagingSenderId: "1090261153702",
  appId: "1:1090261153702:web:05a421d0bf2def0352c167"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Элементы авторизации
const authContainer = document.getElementById('auth-container');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const showLoginLink = document.getElementById('show-login');
const showRegisterLink = document.getElementById('show-register');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');

// Элементы игры
const gameContainer = document.getElementById('game-container');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const roomSelection = document.getElementById('room-selection');
const gameRoom = document.getElementById('game-room');
const currentRoomIdSpan = document.getElementById('current-room-id');
const playersUl = document.getElementById('players-ul');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gamePhase = document.getElementById('game-phase');
const phaseTitle = document.getElementById('phase-title');
const phaseContent = document.getElementById('phase-content');
const phaseActions = document.getElementById('phase-actions');
const endScreen = document.getElementById('end-screen');
const gameResult = document.getElementById('game-result');
const restartGameBtn = document.getElementById('restart-game-btn');

// Текущий пользователь
let currentUser = null;

// Текущая комната
let currentRoom = null;

// Слушатель аутентификации
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
    } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        gameContainer.classList.add('hidden');
    }
});

// Переключение форм регистрации и входа
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

// Регистрация пользователя
registerBtn.addEventListener('click', () => {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();

    if (!username || !email || !password) {
        alert('Пожалуйста, заполните все поля.');
        return;
    }

    // Создание пользователя
    auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
            // Добавление данных пользователя в Firestore
            return db.collection('users').doc(cred.user.uid).set({
                username: username,
                email: email
            });
        })
        .then(() => {
            alert('Регистрация успешна!');
        })
        .catch(err => {
            console.error(err);
            alert(err.message);
        });
});

// Вход пользователя
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        alert('Пожалуйста, заполните все поля.');
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            alert('Вход выполнен успешно!');
        })
        .catch(err => {
            console.error(err);
            alert(err.message);
        });
});

// Выход из системы
logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            alert('Вы вышли из системы.');
        })
        .catch(err => {
            console.error(err);
            alert(err.message);
        });
});

// Создание комнаты
createRoomBtn.addEventListener('click', () => {
    // Генерация уникального ID комнаты
    const roomId = db.collection('rooms').doc().id;
    currentRoomIdSpan.textContent = roomId;

    // Создание документа комнаты
    db.collection('rooms').doc(roomId).set({
        host: currentUser.uid,
        players: [currentUser.uid],
        chat: [],
        gameStarted: false,
        gamePhase: 'waiting',
        roles: {},
        votes: {},
        eliminated: []
    })
    .then(() => {
        currentRoom = roomId;
        roomSelection.classList.add('hidden');
        gameRoom.classList.remove('hidden');
        listenToRoomChanges(roomId);
    })
    .catch(err => {
        console.error(err);
        alert(err.message);
    });
});

// Присоединение к комнате
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Пожалуйста, введите ID комнаты.');
        return;
    }

    const roomRef = db.collection('rooms').doc(roomId);
    roomRef.get()
        .then(doc => {
            if (doc.exists) {
                const roomData = doc.data();
                if (roomData.gameStarted) {
                    alert('Игра уже началась. Нельзя присоединиться.');
                    return;
                }
                if (roomData.players.includes(currentUser.uid)) {
                    alert('Вы уже присоединились к этой комнате.');
                    return;
                }
                roomRef.update({
                    players: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                })
                .then(() => {
                    currentRoom = roomId;
                    currentRoomIdSpan.textContent = roomId;
                    roomSelection.classList.add('hidden');
                    gameRoom.classList.remove('hidden');
                    listenToRoomChanges(roomId);
                });
            } else {
                alert('Комната не найдена.');
            }
        })
        .catch(err => {
            console.error(err);
            alert(err.message);
        });
});

// Слушатель изменений в комнате
function listenToRoomChanges(roomId) {
    const roomRef = db.collection('rooms').doc(roomId);

    roomRef.onSnapshot(doc => {
        if (doc.exists) {
            const roomData = doc.data();
            updatePlayersList(roomData.players);
            updateChat(roomData.chat);
            if (roomData.gameStarted) {
                gameRoom.classList.add('hidden');
                startGame(roomId, roomData);
            }
        }
    });
}

// Обновление списка игроков
function updatePlayersList(players) {
    playersUl.innerHTML = '';
    players.forEach(uid => {
        db.collection('users').doc(uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const li = document.createElement('li');
                    li.textContent = userData.username;
                    playersUl.appendChild(li);
                }
            });
    });
}

// Чат
sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (!message) return;

    const roomRef = db.collection('rooms').doc(currentRoom);
    roomRef.update({
        chat: firebase.firestore.FieldValue.arrayUnion({
            sender: currentUser.uid,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
    })
    .then(() => {
        chatInput.value = '';
    })
    .catch(err => {
        console.error(err);
        alert(err.message);
    });
});

// Обновление чата
function updateChat(chat) {
    chatMessages.innerHTML = '';
    chat.forEach(chatMsg => {
        if (!chatMsg) return; // Пропустить пустые сообщения
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message');
        // Получение имени пользователя
        db.collection('users').doc(chatMsg.sender).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    msgDiv.innerHTML = `<strong>${userData.username}:</strong> ${chatMsg.message}`;
                    chatMessages.appendChild(msgDiv);
                    // Прокрутка вниз
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            });
    });
}

// Начало игры
startGameBtn.addEventListener('click', () => {
    const roomRef = db.collection('rooms').doc(currentRoom);
    roomRef.get()
        .then(doc => {
            if (doc.exists) {
                const roomData = doc.data();
                if (roomData.host !== currentUser.uid) {
                    alert('Только хозяин комнаты может начать игру.');
                    return;
                }
                if (roomData.players.length < 4) {
                    alert('Для начала игры необходимо минимум 4 игрока.');
                    return;
                }
                // Назначение ролей
                assignRoles(roomData.players)
                    .then(roles => {
                        roomRef.update({
                            roles: roles,
                            gameStarted: true,
                            gamePhase: 'night'
                        });
                    });
            }
        })
        .catch(err => {
            console.error(err);
            alert(err.message);
        });
});

// Назначение ролей
async function assignRoles(players) {
    const roles = {};
    const playerCount = players.length;

    // Определение количества мафии
    const mafiaCount = Math.floor(playerCount / 3);
    const rolePool = [];

    // Добавление мафии
    for (let i = 0; i < mafiaCount; i++) {
        rolePool.push('Мафия');
    }

    // Добавление комиссара и доктора
    rolePool.push('Комиссар');
    rolePool.push('Доктор');

    // Добавление мирных жителей
    while (rolePool.length < playerCount) {
        rolePool.push('Мирный житель');
    }

    // Перемешивание ролей
    shuffleArray(rolePool);

    // Назначение ролей игрокам
    players.forEach((uid, index) => {
        roles[uid] = rolePool[index];
    });

    return roles;
}

// Функция для перемешивания массива
function shuffleArray(array) {
    for (let i = array.length -1; i >0; i--){
        const j = Math.floor(Math.random() * (i +1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Начало игры
function startGame(roomId, roomData) {
    gamePhase.classList.remove('hidden');
    gameRoom.classList.add('hidden');
    updateGamePhase(roomData);
    listenToGameChanges(roomId);
}

// Слушатель изменений в игре
function listenToGameChanges(roomId) {
    const roomRef = db.collection('rooms').doc(roomId);

    roomRef.onSnapshot(doc => {
        if (doc.exists) {
            const roomData = doc.data();
            updateGamePhase(roomData);
        }
    });
}

// Обновление фазы игры
function updateGamePhase(roomData) {
    const phase = roomData.gamePhase;
    phaseTitle.textContent = capitalizeFirstLetter(phase);
    phaseContent.innerHTML = '';
    phaseActions.innerHTML = '';

    if (phase === 'night') {
        handleNightPhase(roomData);
    } else if (phase === 'day') {
        handleDayPhase(roomData);
    } else if (phase === 'ended') {
        handleEndPhase(roomData);
    }
}

// Ночная фаза
function handleNightPhase(roomData) {
    phaseContent.innerHTML = `<p>Ночь наступила. Роли выполняют свои действия.</p>`;
    // Тут можно добавить интерфейс для действий мафии, доктора и комиссара
    // Для упрощения автоматически выполняем действия

    setTimeout(() => {
        // Логика ночных действий
        processNightActions(roomData);
    }, 3000); // Задержка для имитации ночных действий
}

// Обработка ночных действий
function processNightActions(roomData) {
    const roles = roomData.roles;
    const players = roomData.players;
    const mafia = players.filter(uid => roles[uid] === 'Мафия');
    const doctor = players.find(uid => roles[uid] === 'Доктор');
    const detective = players.find(uid => roles[uid] === 'Комиссар');

    // Выбор жертвы мафии
    const victims = players.filter(uid => roles[uid] !== 'Мафия' && !roomData.eliminated.includes(uid));
    if (victims.length === 0) {
        alert('Нет доступных жертв для мафии.');
        transitionToDay();
        return;
    }
    const victim = victims[Math.floor(Math.random() * victims.length)];

    // Доктор лечит
    const saved = players[Math.floor(Math.random() * players.length)];

    // Комиссар расследует
    const investigateTargets = players.filter(uid => uid !== detective && !roomData.eliminated.includes(uid));
    let investigated = null;
    let investigatedRole = '';
    if (investigateTargets.length > 0) {
        investigated = investigateTargets[Math.floor(Math.random() * investigateTargets.length)];
        investigatedRole = roles[investigated];
    }

    let message = '';

    if (victim !== saved) {
        // Жертва умирает
        db.collection('rooms').doc(currentRoom).update({
            eliminated: firebase.firestore.FieldValue.arrayUnion(victim)
        });
        message += `Игрок был убит ночью.\n`;
    } else {
        message += `Доктор спас игрока ночью.\n`;
    }

    if (investigated) {
        message += `Комиссар расследовал игрока и узнал, что он ${investigatedRole}.`;
    }

    alert(message);

    // Переход к дневной фазе
    db.collection('rooms').doc(currentRoom).update({
        gamePhase: 'day'
    });
}

// Дневная фаза
function handleDayPhase(roomData) {
    phaseContent.innerHTML = `<p>День наступил. Обсуждение и голосование.</p>`;
    // Отображение списка живых игроков для голосования

    const alivePlayers = roomData.players.filter(uid => !roomData.eliminated.includes(uid));
    const roles = roomData.roles;

    const votingList = document.createElement('ul');
    votingList.id = 'voting-list';

    alivePlayers.forEach(uid => {
        if (uid === currentUser.uid) return; // Игрок не голосует за себя
        db.collection('users').doc(uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const li = document.createElement('li');
                    li.textContent = userData.username;
                    li.dataset.uid = uid;
                    li.addEventListener('click', () => {
                        voteForPlayer(uid);
                    });
                    votingList.appendChild(li);
                }
            });
    });

    phaseContent.appendChild(votingList);
}

// Голосование
function voteForPlayer(votedUid) {
    const roomRef = db.collection('rooms').doc(currentRoom);
    roomRef.update({
        [`votes.${currentUser.uid}`]: votedUid
    })
    .then(() => {
        alert('Ваш голос учтен.');
        phaseActions.innerHTML = `<p>Вы проголосовали за игрока.</p>`;
        checkVotes();
    })
    .catch(err => {
        console.error(err);
        alert(err.message);
    });
}

// Проверка голосов
function checkVotes() {
    const roomRef = db.collection('rooms').doc(currentRoom);
    roomRef.get()
        .then(doc => {
            if (doc.exists) {
                const roomData = doc.data();
                const votes = roomData.votes;
                const voteCounts = {};

                for (let voter in votes) {
                    const vote = votes[voter];
                    voteCounts[vote] = (voteCounts[vote] || 0) + 1;
                }

                const maxVotes = Math.max(...Object.values(voteCounts));
                const candidates = Object.keys(voteCounts).filter(uid => voteCounts[uid] === maxVotes);

                if (candidates.length === 1) {
                    const eliminatedUid = candidates[0];
                    roomRef.update({
                        eliminated: firebase.firestore.FieldValue.arrayUnion(eliminatedUid),
                        gamePhase: 'night',
                        votes: {}
                    });
                    db.collection('users').doc(eliminatedUid).get()
                        .then(doc => {
                            if (doc.exists) {
                                const userData = doc.data();
                                alert(`${userData.username} был выведен голосованием.`);
                            }
                        });
                } else {
                    // Ничья, голосование повторяется
                    alert('Ничья. Голосование повторяется.');
                    roomRef.update({
                        votes: {}
                    });
                }
            }
        })
        .catch(err => {
            console.error(err);
            alert(err.message);
        });
}

// Завершение игры
function handleEndPhase(roomData) {
    const roles = roomData.roles;
    const players = roomData.players;
    const eliminated = roomData.eliminated;

    let mafiaCount = 0;
    let citizenCount = 0;

    players.forEach(uid => {
        if (eliminated.includes(uid)) return;
        if (roles[uid] === 'Мафия') mafiaCount++;
        else citizenCount++;
    });

    if (mafiaCount === 0) {
        gameResult.textContent = 'Мирные жители победили!';
    } else if (mafiaCount >= citizenCount) {
        gameResult.textContent = 'Мафия победила!';
    } else {
        // Продолжаем игру
        db.collection('rooms').doc(currentRoom).update({
            gamePhase: 'night'
        });
        return;
    }

    // Завершение игры
    gamePhase.classList.add('hidden');
    endScreen.classList.remove('hidden');
}

// Перезапуск игры
restartGameBtn.addEventListener('click', () => {
    db.collection('rooms').doc(currentRoom).update({
        gameStarted: false,
        gamePhase: 'waiting',
        roles: {},
        votes: {},
        eliminated: []
    })
    .then(() => {
        endScreen.classList.add('hidden');
        roomSelection.classList.remove('hidden');
    })
    .catch(err => {
        console.error(err);
        alert(err.message);
    });
});

// Функция для капитализации первой буквы
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
