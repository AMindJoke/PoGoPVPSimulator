# Project Vision

PoGoPVPSimulator should grow from a battle calculator into a Pokemon GO PvP training platform.

The current 1v1 simulator is the foundation: it helps players test matchups, compare move timing, inspect damage, and understand how shields, HP, and energy affect a fight. The long-term goal is to build on that foundation until the project can help a player improve the way they think during real battles.

## Long-Term Goal

The platform should combine three layers:

1. A reliable simulator for matchup mechanics.
2. A training environment for learning PvP decisions.
3. A Battle Review Engine that explains decisions after a battle.

The simulator should not only answer "what happened?" It should eventually help answer:

- What was my win condition?
- What was my opponent likely trying to do?
- Was shielding correct?
- Was switching correct?
- Did I preserve or lose alignment?
- Did I manage energy well?
- What alternative line had a better chance to win?

## 3v3 Direction

The future 3v3 engine should not treat a battle as three isolated 1v1 matchups. A 3v3 game is a continuous resource-management problem involving:

- HP
- Energy
- Shields
- Switch timer
- Alignment
- Information
- Pressure

Each action should be evaluated by how it affects the chance of winning the entire game, not only the current turn or current matchup.

## Decision Engine

The Decision Engine should reason like a strong PvP player. It should evaluate the current win condition, estimate the opponent's win condition, update probabilities about hidden Pokemon, and choose the line with the best long-term expected value.

The engine should use probabilities instead of certainty. Opponent behavior gives information, but it should not prove a single backline or team structure by itself.

## Battle Review Engine

The Battle Review Engine should become the teaching layer of the platform. After a battle, it should explain:

- The player's likely win condition.
- The opponent's likely win condition.
- Key turning points.
- Shield quality.
- Switch quality.
- Energy management.
- Alignment decisions.
- Alternative lines with higher expected win probability.

The final product should feel like a coach: practical, explainable, and focused on helping the player improve.
