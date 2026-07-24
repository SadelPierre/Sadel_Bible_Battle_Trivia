# Game Rules

## The basics

- Every match is a series of timed multiple-choice Bible questions (4 options, exactly one correct).
- Everyone answers the same question at the same time (except pass-and-play, where players take private turns on one device).
- When the timer expires — or everyone has answered — answers lock and the correct answer is revealed with its **Bible reference** and a short **explanation** (plus a KJV excerpt on many questions).
- After the reveal, scores update with animation and the next question begins (auto-advance, or the host presses Continue online).
- Every `roundSize` questions (default 5) a **Round Summary** shows standings, streaks, and the fastest correct answer.
- After the last question the **Final Results** screen crowns the winner with confetti and full stats (correct count, accuracy, average response time, best streak), and offers Rematch / Return to Lobby / Home.

## Timer

- Choose 10, 15, 20, or 30 seconds per question.
- The ring is purple normally, turns **gold at 5 seconds**, and **red with a shake for the final 3** (with warning ticks if sound is on).
- At zero, a Time's Up state locks all answers — unanswered players score 0 for that question.
- Online, the server's clock is authoritative. Clients display the server deadline adjusted for measured clock offset, and the server accepts answers up to a 750 ms grace window to absorb network latency.

## Scoring

| Event | Points |
| --- | --- |
| Correct answer | **100** |
| Wrong answer / no answer | 0 |
| Speed bonus (optional) | up to **+50**, proportional to time remaining |
| Streak bonus (optional) | 2 in a row **+10**, 3 → **+20**, 4 → **+30**… capped at **+50** |

Scoring styles: **Standard** (base only), **Speed Bonus**, **Streak Bonus**, or **Both**. A wrong or missed answer resets your streak.

## Tie-breakers

1. Highest total score
2. Most correct answers
3. Fastest **average** response time on correct answers
4. Still tied → players **share the position** (a shared #1 means multiple winners)

## Game modes

### Play Against Computer
1–3 bots at Easy (≈40–55 % correct, slower), Medium (≈60–75 %, varied), or Hard (≈80–92 %, faster). Bots "think" for a human-like time, are affected by question difficulty, and never answer instantly.

### Local — Shared Screen
2–4 players see the question together; each has a labeled A/B/C/D row. Keyboard players: P1 = `1 2 3 4`, P2 = `Q W E R`, P3 = `A S D F`, P4 = `Z X C V`. First tap wins per player — you can't change your answer.

### Local — Pass-and-Play
Players take turns per question. The screen shows **whose turn it is**; the next player must press "Show my question" before the question appears (so nobody peeks), and each turn gets a **fresh full timer**. After the last player, the answer is revealed.

### Online
- Create a private room → you're the host and get a 5-letter code + invite link (codes avoid look-alike characters like O/0).
- 2–4 players; the host can fill empty seats with bots, remove players, and set the game settings.
- Everyone marks **Ready**; only the host can start.
- During a question you can see *who* has answered, but never *what* they chose.
- **Disconnects:** refresh or reopen the invite link to reclaim your seat; the game continues without you meanwhile (your unanswered questions score 0). If the **host** is gone ~45 s, host status transfers to the longest-connected human player. Rooms expire after 24 h.
- **Rematch:** from the final screen the host can start a rematch (recent questions are avoided) or return everyone to the lobby.

### Online Tournament (knockout)
A large-field survival mode for **up to 30 players**.

- Create a tournament from the Online screen → you're the host of a room that seats up to 30. Share the code/link; the host can also fill empty seats with bots.
- The host starts once **at least 3** competitors have joined — there's no per-player Ready gate.
- **Field stage:** everyone answers the same question stream at the same time. After each question the field is ranked by total score (correct answers + speed) and the **lowest scorers are cut**. The survivor target shrinks every round — e.g. a full field of 30 goes 30 → 18 → 11 → 7 → 5 → 3 → 2 — so the pack always converges to two finalists.
- **Duel final:** the last two play **sudden-death** questions. Each question is won outright — a correct answer beats a wrong one, and if both are correct the **faster** answer wins (if both miss, the point simply carries to the next question). First to **2** question-wins is crowned champion.
- **Eliminated?** You become a **spectator** — you keep watching the live questions and the shrinking leaderboard, but can no longer answer. The round never waits on eliminated players.
- The final screen crowns the **champion** and shows the full knockout order (champion, runner-up, then everyone by how far they lasted). The host can launch a new tournament or return to the lobby.

## Fair play

Online scores, timers, question order, and correct answers all live on the server. The correct answer is never sent to your browser until the reveal, and the server rejects late, duplicate, or out-of-range answers — so no browser tricks can change a result.
