# Battle Philosophy

High-level Pokemon GO PvP is not only about winning the current matchup. In 3v3, every turn changes the value of HP, energy, shields, switch timer, alignment, information, and pressure.

The future AI should think like a strong player: it should continuously ask what line gives the best chance to win the whole game, not what line wins the current turn in isolation.

## Core Resources

### HP

HP is not only a health bar. It is a resource that can be spent to gain energy, preserve shields, keep alignment, or set up a future farm down.

Taking damage can be correct if it creates a stronger endgame.

### Energy

Energy is one of the most important long-term resources. A player may overfarm before throwing a charged move because extra energy can create pressure in the next matchup.

The AI should avoid wasting energy over the 100 energy cap, but it should not always throw immediately when a move becomes available. Good players often throw as late as safely possible.

### Shields

Shields are not only damage prevention. A shield can preserve alignment, protect a win condition, enable a farm down, or force the opponent to reveal their plan.

Shield quality matters more than shield count alone.

### Switch Timer

The switch timer controls how risky a swap is and how long a player can be punished by alignment. A good decision engine must account for whether switching creates escape routes or traps the player.

### Alignment

Alignment is often worth more than immediate HP. A player may stay in a bad matchup, soft-lose, or sacrifice a Pokemon if it preserves a better alignment for the backline.

### Information

In 3v3, hidden Pokemon matter. The AI should update probabilities based on opponent behavior, but it should not assume certainty.

For example, staying in a losing lead may suggest that the opponent values alignment or has a backline weak to the lead Pokemon. It does not prove a specific team.

### Pressure

Pressure is created by energy, shield threats, switch advantage, possible catches, and hidden backline uncertainty. A player can be ahead even before dealing damage if the opponent is forced into bad choices.

## Win Conditions

Every decision should be evaluated against the current win condition.

Possible win conditions include:

- Preserve alignment.
- Take shield advantage.
- Build energy for a closer.
- Force the opponent to reveal their backline.
- Soft-lose lead with energy advantage.
- Sacrifice a Pokemon to regain switch or farm.
- Save shields for one specific Pokemon.

The win condition can change during the battle. The AI should update it as HP, energy, shields, switch timer, and information change.

## Reading Opponent Behavior

Opponent behavior is evidence, not certainty.

- Staying in a bad lead may mean alignment matters, the backline is weak, or the opponent is intentionally soft-losing.
- Immediate switching may indicate a safe swap, bait switch, or sacrifice.
- Shield timing can reveal which Pokemon is central to the opponent's plan.
- Overfarming may indicate preparation for the next matchup.
- Throw timing can reveal whether the opponent is trying to deny energy, avoid a catch, or preserve future pressure.

The AI should reason probabilistically and update beliefs instead of hard-coding one interpretation.

## Player Skill Model

The same action can mean different things depending on player skill.

### Beginner

A beginner may stay in a losing matchup because they do not recognize the danger or do not know the correct swap.

### Intermediate

An intermediate player may understand basic alignment and shielding but miss deeper energy or endgame planning.

### Expert

An expert player is more likely to use soft losses, energy preservation, baiting, catches, and switch timer awareness intentionally.

### Professional

A professional player may choose a line that looks losing in the short term because it supports a broader win condition several turns later.

The AI should not assume perfect play by default. It should adjust interpretation based on the estimated skill level.

## Decision Principle

The AI should never optimize a single turn in isolation.

A strong decision should consider:

- Current matchup.
- Future alignment.
- Shield value.
- Energy value.
- Switch timer.
- Hidden backline probabilities.
- Opponent win condition.
- Player skill model.
- Expected win probability across the whole game.

The final goal is an explainable AI that can say not only what it chose, but why that line was better.
