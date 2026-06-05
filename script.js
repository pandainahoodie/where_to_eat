import { db } from "./firebase.js";

import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const createRoomBtn = document.getElementById("create-room");
const roomScreen = document.getElementById("room-screen");
const roomCodeElement = document.getElementById("room-code");

const restaurantInput = document.getElementById("restaurant-name");
const addRestaurantBtn = document.getElementById("add-restaurant");
const restaurantList = document.getElementById("restaurant-list");

const startVotingBtn = document.getElementById("start-voting");

const voteScreen = document.getElementById("vote-screen");
const voteRestaurant = document.getElementById("vote-restaurant");

const likeBtn = document.getElementById("like-btn");
const passBtn = document.getElementById("pass-btn");

const waitingScreen = document.getElementById("waiting-screen");
const waitingCount = document.getElementById("waiting-count");

const resultScreen = document.getElementById("result-screen");
const winnerName = document.getElementById("winner-name");
const standingsList = document.getElementById("standings-list");

const joinRoomBtn = document.getElementById("join-room");
const joinCodeInput = document.getElementById("join-code");

const homeScreen = document.getElementById("home-screen");
const createScreen = document.getElementById("create-screen");
const joinScreen = document.getElementById("join-screen");

const createUsernameInput = document.getElementById("create-username");
const joinUsernameInput = document.getElementById("join-username");

const goCreateRoomBtn = document.getElementById("go-create-room");
const goJoinRoomBtn = document.getElementById("go-join-room");

const backFromCreateBtn = document.getElementById("back-from-create");
const backFromJoinBtn = document.getElementById("back-from-join");

let restaurants = [];
let votes = {};

let currentIndex = 0;
let currentRoomCode = null;
let currentUsername = null;
let isHost = false;
let participantCount = 0;
let voteCount = 0;
let hasStartedVotingUI = false;
let currentPhase = "lobby";

let deviceId = localStorage.getItem("deviceId");

if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem("deviceId", deviceId);
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function registerParticipant(roomCode) {
  await setDoc(doc(db, "rooms", roomCode, "participants", deviceId), {
    username: currentUsername,
    deviceId,
    joinedAt: Date.now(),
  });
}

goCreateRoomBtn.addEventListener("click", () => {
  homeScreen.classList.add("hidden");
  createScreen.classList.remove("hidden");
});

goJoinRoomBtn.addEventListener("click", () => {
  homeScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
});

backFromCreateBtn.addEventListener("click", () => {
  createScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
});

backFromJoinBtn.addEventListener("click", () => {
  joinScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
});

createRoomBtn.addEventListener("click", async () => {
  const username = createUsernameInput.value.trim();

  if (!username) {
    alert("Enter your name");
    return;
  }

  currentUsername = username;
  isHost = true;

  const roomCode = generateRoomCode();

  await setDoc(doc(db, "rooms", roomCode), {
    code: roomCode,
    phase: "lobby",
    createdAt: Date.now(),
    createdBy: username,
    resultsReady: false,
  });

  currentRoomCode = roomCode;
  hasStartedVotingUI = false;

  await registerParticipant(roomCode);

  roomCodeElement.textContent = roomCode;

  listenForRestaurants();
  listenForParticipants();
  listenForVoteCounts();
  listenForRoom();

  createScreen.classList.add("hidden");
  roomScreen.classList.remove("hidden");
});

joinRoomBtn.addEventListener("click", async () => {
  const username = joinUsernameInput.value.trim();

  if (!username) {
    alert("Enter your name");
    return;
  }

  currentUsername = username;
  isHost = false;
  startVotingBtn.style.display = "none";

  const roomCode = joinCodeInput.value.trim().toUpperCase();

  if (!roomCode) return;

  const roomSnap = await getDoc(doc(db, "rooms", roomCode));

  if (!roomSnap.exists()) {
    alert("Room not found");
    return;
  }

  currentRoomCode = roomCode;
  hasStartedVotingUI = false;

  await registerParticipant(roomCode);

  roomCodeElement.textContent = roomCode;

  listenForRestaurants();
  listenForParticipants();
  listenForVoteCounts();
  listenForRoom();

  joinScreen.classList.add("hidden");

  const room = roomSnap.data();

  if (room.phase === "voting") {
    roomScreen.classList.add("hidden");
    voteScreen.classList.remove("hidden");

    currentIndex = 0;
    votes = {};

    setTimeout(showRestaurant, 300);
  } else if (room.phase === "results") {
    roomScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");
  } else {
    roomScreen.classList.remove("hidden");
  }
});

addRestaurantBtn.addEventListener("click", async () => {
  const name = restaurantInput.value.trim();

  if (!name) return;

  const alreadyExists = restaurants.some(
    (restaurant) => restaurant.name.toLowerCase() === name.toLowerCase(),
  );

  if (alreadyExists) {
    alert("Restaurant already added");
    return;
  }

  if (currentPhase !== "lobby") {
    alert("Voting has already started");
    return;
  }

  await addDoc(collection(db, "rooms", currentRoomCode, "restaurants"), {
    name,
    createdAt: Date.now(),
    addedBy: deviceId,
  });

  restaurantInput.value = "";
});

startVotingBtn.addEventListener("click", async () => {
  if (!isHost) return;

  if (restaurants.length === 0) {
    alert("Add at least one restaurant");
    return;
  }

  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "voting",
  });
});

function showRestaurant() {
  if (!restaurants.length) return;

  voteRestaurant.textContent = restaurants[currentIndex].name;
}

async function vote(liked) {
  const restaurant = restaurants[currentIndex].name;

  votes[restaurant] = liked;

  currentIndex++;

  if (currentIndex >= restaurants.length) {
    await finishVoting();
    return;
  }

  showRestaurant();
}

likeBtn.addEventListener("click", () => {
  vote(true);
});

passBtn.addEventListener("click", () => {
  vote(false);
});

async function finishVoting() {
  const voteRef = doc(db, "rooms", currentRoomCode, "votes", deviceId);

  const existingVote = await getDoc(voteRef);

  if (existingVote.exists()) {
    return;
  }

  await setDoc(voteRef, {
    username: currentUsername,
    deviceId,
    votes,
    finishedAt: Date.now(),
  });

  voteScreen.classList.add("hidden");
  waitingScreen.classList.remove("hidden");

  await checkIfVotingFinished();
}

async function checkIfVotingFinished() {
  const participantsSnapshot = await getDocs(
    collection(db, "rooms", currentRoomCode, "participants"),
  );

  const votesSnapshot = await getDocs(
    collection(db, "rooms", currentRoomCode, "votes"),
  );

  const participantCount = participantsSnapshot.size;

  const voteCount = votesSnapshot.size;

  if (voteCount < participantCount) {
    return;
  }

  const standings = {};

  votesSnapshot.forEach((voteDoc) => {
    const userVotes = voteDoc.data().votes || {};

    Object.entries(userVotes).forEach(([restaurant, liked]) => {
      if (!liked) return;

      standings[restaurant] = (standings[restaurant] || 0) + 1;
    });
  });

  const sortedStandings = Object.entries(standings)
    .sort((a, b) => b[1] - a[1])
    .map(([restaurant, votes]) => ({
      restaurant,
      votes,
    }));

  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "results",
    resultsReady: true,
    standings: sortedStandings,
    winner: sortedStandings.length ? sortedStandings[0].restaurant : null,

    winnerVotes: sortedStandings.length ? sortedStandings[0].votes : 0,
  });
}

function showResults(roomData) {
  waitingScreen.classList.add("hidden");
  voteScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");

  resultScreen.classList.remove("hidden");

  const standings = roomData.standings || [];

  if (!standings.length) {
    winnerName.textContent = "No restaurant selected 😭";

    standingsList.innerHTML = "";

    return;
  }

  winnerName.textContent = `${roomData.winner} (${roomData.winnerVotes} votes)`;

  standingsList.innerHTML = "";

  standings.forEach((item, index) => {
    const restaurant = item.restaurant;

    const count = item.votes;

    const div = document.createElement("div");

    let medal = "";

    if (index === 0) medal = "🥇";
    else if (index === 1) medal = "🥈";
    else if (index === 2) medal = "🥉";

    div.className = "standing-item";

    div.textContent = `${medal} ${restaurant} — ${count} vote${count !== 1 ? "s" : ""}`;

    standingsList.appendChild(div);
  });
}

function listenForRestaurants() {
  onSnapshot(
    collection(db, "rooms", currentRoomCode, "restaurants"),
    (snapshot) => {
      restaurants = [];

      restaurantList.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        const restaurant = data.name;

        restaurants.push({
          id: docSnap.id,
          name: restaurant,
        });

        if (!isHost && data.addedBy !== deviceId) {
          return;
        }

        const li = document.createElement("li");

        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = restaurant;

        li.appendChild(nameSpan);

        if (isHost) {
          const deleteBtn = document.createElement("button");

          deleteBtn.className = "delete-btn";
          deleteBtn.textContent = "✕";

          deleteBtn.addEventListener("click", async () => {
            await deleteDoc(
              doc(db, "rooms", currentRoomCode, "restaurants", docSnap.id),
            );
          });

          li.appendChild(deleteBtn);
        }

        restaurantList.appendChild(li);
      });
    },
  );
}

function listenForVoteCounts() {
  onSnapshot(collection(db, "rooms", currentRoomCode, "votes"), (snapshot) => {
    voteCount = snapshot.size;

    waitingCount.textContent = `${voteCount} / ${participantCount} finished`;
  });
}

function listenForParticipants() {
  onSnapshot(
    collection(db, "rooms", currentRoomCode, "participants"),
    (snapshot) => {
      participantCount = snapshot.size;

      waitingCount.textContent = `${voteCount} / ${participantCount} finished`;
    },
  );
}

function listenForRoom() {
  onSnapshot(doc(db, "rooms", currentRoomCode), async (snapshot) => {
    const room = snapshot.data();

    if (!room) return;

    currentPhase = room.phase;

    if (room.phase === "voting") {
      const voteSnap = await getDoc(
        doc(db, "rooms", currentRoomCode, "votes", deviceId),
      );

      if (!voteSnap.exists()) {
        roomScreen.classList.add("hidden");
        waitingScreen.classList.add("hidden");
        resultScreen.classList.add("hidden");

        voteScreen.classList.remove("hidden");

        if (!hasStartedVotingUI) {
          hasStartedVotingUI = true;

          currentIndex = 0;
          votes = {};

          showRestaurant();
        }
      }

      if (voteSnap.exists()) {
        voteScreen.classList.add("hidden");

        waitingScreen.classList.remove("hidden");
      }
    }

    if (room.phase === "results") {
      showResults(room);
    }
  });
}
