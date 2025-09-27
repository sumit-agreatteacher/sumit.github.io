#!/usr/bin/env python3
# tenure_simulator.py
"""
Tenure track card/resource simulation.
Implements characters, actions (rest/lab/teach/bar), NPC policies, turn flow,
and final ending checks consistent with user's 6 endings and priority rules.

Usage:
    python tenure_simulator.py            # run default Monte-Carlo (auto, 2000 runs)
    python tenure_simulator.py --runs 5000 --seed 42
    python tenure_simulator.py --mode interactive   # play one interactive game (Sumit chooses)
"""

import random
import argparse
import statistics
import json
from collections import Counter, defaultdict

# ---------------------------
# Global parameters (from design)
# ---------------------------
GLOBAL = {
    "base_turns": 12,
    "apply_energy_cost": 6,   # energy cost to request +1 extra turn (only Sumit can choose)
    "max_extra_turns": 3,     # cap for extra turns
    "p_breakthrough": 0.05,
    "breakthrough_progress_bonus": 15,
    "breakthrough_rep_bonus": 5,
    "breakthrough_nobel_tiny_p": 0.005,  # tiny chance on a breakthrough for Nobel-ish event
    "lab_progress_per_energy": 2.0,
    "lab_funding_cost_per_energy": 1.8,
    "lab_rep_per_energy": 0.05,
    "teach_rep_per_energy": 1.2,
    "teach_funding_cost_per_energy": 0.3,
    "rest_energy_base": 8,
    "rest_energy_per_stamina_coef": 0.2,
    "bar_energy_boost": 3,
    "bar_energy_boost_prob": 0.7,
    "bar_drunk_energy_loss": 6,
    "min_energy_for_action": 1,
}

# ---------------------------
# Character definition
# ---------------------------
class Character:
    def __init__(self, spec):
        # spec is a dict containing initial values
        self.name = spec["name"]
        self.max_energy = spec["max_energy"]
        self.energy = spec["init_energy"]
        self.stamina = spec["stamina"]
        self.lab_efficiency = spec["lab_efficiency"]
        self.lab_funding_mult = spec["lab_funding_mult"]
        self.rep_efficiency = spec["rep_efficiency"]
        self.teach_efficiency = spec["teach_efficiency"]
        self.drunk_susceptibility = spec["drunk_susceptibility"]
        self.progress = spec["init_progress"]
        self.reputation = spec["init_reputation"]
        self.funding = spec["init_funding"]
        self.is_npc = spec.get("npc", False)
        self.policy = spec.get("policy", {})  # only for NPC
        # track if joined (for spawn timing)
        self.joined = spec.get("joined_initial", False)

    def clamp(self):
        if self.progress < 0:
            self.progress = 0
        if self.progress > 100:
            self.progress = 100
        if self.reputation < 0:
            self.reputation = 0
        if self.reputation > 100:
            self.reputation = 100
        if self.energy < 0:
            self.energy = 0
        # funding allowed to be >=0, but negative triggers Funding Disaster in simulation stop logic

    def stats(self):
        return {
            "name": self.name,
            "energy": round(self.energy, 1),
            "progress": round(self.progress, 1),
            "reputation": round(self.reputation, 1),
            "funding": round(self.funding, 1),
        }

# ---------------------------
# Character specs (5 characters)
# ---------------------------
CHAR_SPECS = [
    {
      "name": "Sumit",
      "max_energy": 2000,
      "init_energy": 15,
      "stamina": 3,
      "lab_efficiency": 1.0,
      "lab_funding_mult": 1.0,
      "rep_efficiency": 1.0,
      "teach_efficiency": 1.0,
      "drunk_susceptibility": 0.12,
      "init_progress": 0,
      "init_reputation": 10,
      "init_funding": 20,
      "npc": False,
      "joined_initial": True,
    },
    {
      "name": "Dr. Lee",
      "max_energy": 18,
      "init_energy": 12,
      "stamina": 2,
      "lab_efficiency": 1.35,
      "lab_funding_mult": 1.6,
      "rep_efficiency": 0.8,
      "teach_efficiency": 0.4,
      "drunk_susceptibility": 0.10,
      "init_progress": 10,
      "init_reputation": 8,
      "init_funding": 30,
      "npc": True,
      "policy": {"lab": 0.7, "rest": 0.1, "bar": 0.05, "teach": 0.15},
      "joined_initial": False,
    },
    {
      "name": "Prof. Gomez",
      "max_energy": 16,
      "init_energy": 12,
      "stamina": 3,
      "lab_efficiency": 0.7,
      "lab_funding_mult": 0.9,
      "rep_efficiency": 1.5,
      "teach_efficiency": 1.6,
      "drunk_susceptibility": 0.08,
      "init_progress": 5,
      "init_reputation": 25,
      "init_funding": 12,
      "npc": True,
      "policy": {"teach": 0.7, "rest": 0.1, "lab": 0.1, "bar": 0.1},
      "joined_initial": False,
    },
    {
      "name": "Dr. Patel",
      "max_energy": 14,
      "init_energy": 10,
      "stamina": 4,
      "lab_efficiency": 0.9,
      "lab_funding_mult": 0.6,
      "rep_efficiency": 0.9,
      "teach_efficiency": 0.8,
      "drunk_susceptibility": 0.18,
      "init_progress": 8,
      "init_reputation": 12,
      "init_funding": 25,
      "npc": True,
      "policy": {"lab": 0.4, "teach": 0.25, "rest": 0.2, "bar": 0.15},
      "joined_initial": False,
    },
    {
      "name": "Alex",
      "max_energy": 18,
      "init_energy": 14,
      "stamina": 1,
      "lab_efficiency": 0.6,
      "lab_funding_mult": 0.8,
      "rep_efficiency": 1.1,
      "teach_efficiency": 0.6,
      "drunk_susceptibility": 0.35,
      "init_progress": 4,
      "init_reputation": 6,
      "init_funding": 10,
      "npc": True,
      "policy": {"bar": 0.5, "rest": 0.2, "teach": 0.15, "lab": 0.15},
      "joined_initial": False,
    },
]

# ---------------------------
# Actions implementations
# ---------------------------
def action_rest(ch: Character):
    recover = GLOBAL["rest_energy_base"] + GLOBAL["rest_energy_per_stamina_coef"] * ch.stamina
    # cannot exceed max_energy
    before = ch.energy
    ch.energy = min(ch.max_energy, ch.energy + recover)
    # rest does not consume funding/progress/reputation
    ch.clamp()
    # return summary
    return {"action": "rest", "energy_change": ch.energy - before}

def action_lab(ch: Character, energy_spent):
    if energy_spent <= 0:
        return {}
    # reduce energy
    ch.energy -= energy_spent
    # progress:
    progress_gain = energy_spent * GLOBAL["lab_progress_per_energy"] * ch.lab_efficiency
    ch.progress += progress_gain
    # funding cost:
    funding_cost = energy_spent * GLOBAL["lab_funding_cost_per_energy"] * ch.lab_funding_mult
    ch.funding -= funding_cost
    # reputation tiny:
    rep_gain = energy_spent * GLOBAL["lab_rep_per_energy"] * ch.rep_efficiency
    ch.reputation += rep_gain

    # breakthrough checks: for each energy unit we could check, but to save time, do one check per action with probability scaled:
    # We'll approximate multiple trials: chance_of_at_least_one = 1 - (1 - p)^energy_spent
    p = GLOBAL["p_breakthrough"]
    chance = 1.0 - (1.0 - p) ** energy_spent
    if random.random() < chance:
        ch.progress += GLOBAL["breakthrough_progress_bonus"]
        ch.reputation += GLOBAL["breakthrough_rep_bonus"]
        # tiny additional random for Nobel-like event (just a flag, not special handling besides increasing both)
        if random.random() < GLOBAL["breakthrough_nobel_tiny_p"]:
            # additional small boost
            ch.progress = min(100.0, ch.progress + 5)
            ch.reputation = min(100.0, ch.reputation + 3)
        brk = True
    else:
        brk = False

    ch.clamp()
    return {
        "action": "lab",
        "energy_spent": energy_spent,
        "progress_gain": progress_gain + (GLOBAL["breakthrough_progress_bonus"] if brk else 0),
        "funding_cost": funding_cost,
        "rep_gain": rep_gain + (GLOBAL["breakthrough_rep_bonus"] if brk else 0),
        "breakthrough": brk,
    }

def action_teach(ch: Character, energy_spent):
    if energy_spent <= 0:
        return {}
    ch.energy -= energy_spent
    rep_gain = energy_spent * GLOBAL["teach_rep_per_energy"] * ch.teach_efficiency * ch.rep_efficiency
    ch.reputation += rep_gain
    funding_cost = energy_spent * GLOBAL["teach_funding_cost_per_energy"]
    ch.funding -= funding_cost
    ch.clamp()
    return {"action": "teach", "energy_spent": energy_spent, "rep_gain": rep_gain, "funding_cost": funding_cost}

def action_bar(ch: Character, energy_spent):
    """
    For each unit of energy spent at the bar:
      - with prob p_boost => gain +bar_energy_boost (energy restored)
      - elif with prob drunk_susceptibility => lose bar_drunk_energy_loss
      - else nothing
    We apply compounding effects but clamp energy to >= 0 and <= max_energy afterwards.
    """
    if energy_spent <= 0:
        return {}
    ch.energy -= energy_spent  # you spend the time/energy to go to bar
    total_energy_change = 0.0
    rep_gain = 0.0
    for _ in range(int(round(energy_spent))):
        r = random.random()
        if r < GLOBAL["bar_energy_boost_prob"]:
            total_energy_change += GLOBAL["bar_energy_boost"]
        elif r < GLOBAL["bar_energy_boost_prob"] + ch.drunk_susceptibility:
            total_energy_change -= GLOBAL["bar_drunk_energy_loss"]
            # small rep bump for being 'social' even if drunk
            rep_gain += 0.5
        else:
            # small social rep bump
            rep_gain += 0.2
    ch.energy += total_energy_change
    ch.reputation += rep_gain
    ch.clamp()
    return {"action": "bar", "energy_spent": energy_spent, "energy_change": total_energy_change, "rep_gain": rep_gain}

# ---------------------------
# Utility: allocate integer energy according to a fractional policy
# ---------------------------
def allocate_energy_integer(total, frac_map):
    # frac_map: dict action->fraction sum<=1 (if <1 leftover means rest/do nothing)
    # returns dict action->int energy allocation, sum <= total
    # strategy: multiply and floor, then distribute remaining by largest remainder
    actions = list(frac_map.keys())
    floats = {a: frac_map[a] * total for a in actions}
    alloc = {a: int(floats[a]) for a in actions}
    used = sum(alloc.values())
    leftover = int(round(total - used))
    # compute remainders
    remainders = sorted(actions, key=lambda a: floats[a] - alloc[a], reverse=True)
    idx = 0
    while leftover > 0 and idx < len(remainders):
        alloc[remainders[idx]] += 1
        leftover -= 1
        idx += 1
    # final cap
    for a in alloc:
        if alloc[a] < 0:
            alloc[a] = 0
    # if still leftover (rare), just give to first action
    if leftover > 0 and actions:
        alloc[actions[0]] += leftover
    return alloc

# ---------------------------
# Ending check (priority)
# Priority as you specified:
# 1) energy == 0 -> Burnout (immediate)
# 2) funding == 0 and energy > 0 -> Funding Disaster (immediate)
# 3) Final-turn: check Nobel / True / Teaching / Experiment Chaos (with funding>0 & energy>0)
# ---------------------------
def check_immediate_ending(ch: Character):
    if ch.energy <= 0:
        return "Burnout"
    if ch.funding <= 0 and ch.energy > 0:
        return "Funding Disaster"
    return None

def final_ending_for_player(ch: Character):
    # assume energy>0 and funding>0 here
    # 6 endings mapping (for the protagonist)
    # 6. Secret Nobel: progress==100 & funding>0 & energy>0 & reputation==100
    if ch.progress >= 100 and ch.reputation >= 100 and ch.funding > 0 and ch.energy > 0:
        return "Secret Nobel"
    # 1. True Ending – Tenure Achieved: progress =100, fundings>0, energy>0. reputation<100.
    if ch.progress >= 100 and ch.funding > 0 and ch.energy > 0 and ch.reputation < 100:
        return "True Ending"
    # 4. Teaching Hero: energy>0, funding>0, progress<100, reputation=100
    if ch.energy > 0 and ch.funding > 0 and ch.progress < 100 and ch.reputation >= 100:
        return "Teaching Hero"
    # 5. Experimental Chaos (Cat): energy >0, funding >0, progress<100, reputation<100
    if ch.energy > 0 and ch.funding > 0 and ch.progress < 100 and ch.reputation < 100:
        return "Experimental Chaos"
    # fallback (shouldn't reach if funding>0/energy>0)
    return "Experimental Chaos"

# ---------------------------
# Game flow for one simulation
# ---------------------------
class Game:
    def __init__(self, mode="auto"):
        # instantiate characters
        self.characters = [Character(spec) for spec in CHAR_SPECS]
        # map by name
        self.by_name = {c.name: c for c in self.characters}
        # initially only those with joined_initial True are active
        self.active = [c for c in self.characters if c.joined]
        # supply queue for joining order (exclude Sumit who is joined)
        self.join_queue = [c for c in self.characters if not c.joined]
        # game parameters
        self.base_turns = GLOBAL["base_turns"]
        self.extra_turns = 0
        self.turn = 0
        self.mode = mode  # 'auto' or 'interactive'
        self.ended = False
        self.ending = None

    def spawn_if_needed(self):
        # Called at the start of each turn to possibly add new person.
        # Your rule: round 2,6,10 will definitely add one person. Other rounds may randomly add one person.
        # Implementation: if join_queue not empty, add accordingly.
        must_spawn_rounds = {2, 6, 10}
        if self.turn in must_spawn_rounds and self.join_queue:
            new = self.join_queue.pop(0)
            new.joined = True
            # reset their energy to init_energy (already set)
            self.active.append(new)
            #print(f"[spawn] Turn {self.turn}: {new.name} joined (forced).")
        else:
            # small prob to spawn on other rounds (20%)
            if self.join_queue and random.random() < 0.2:
                new = self.join_queue.pop(0)
                new.joined = True
                self.active.append(new)
                #print(f"[spawn] Turn {self.turn}: {new.name} joined (random).")

    def run_one_turn(self):
        self.turn += 1
        self.spawn_if_needed()
        # iterate over active characters
        # for Sumit: interactive or auto policy
        for ch in list(self.active):
            # if the game already ended due to earlier actors this turn, break
            if self.ended:
                return
            # immediate check before action? We'll check after actions to detect energy depletion
            if ch.is_npc:
                self._npc_take_actions(ch)
            else:
                # Sumit (player)
                if self.mode == "interactive":
                    self._interactive_player_turn(ch)
                else:
                    self._auto_player_turn(ch)
            # after each character's actions, check immediate endings for that character
            im = check_immediate_ending(ch)
            if im:
                # only protagonist's ending is used for final classification in this simulation
                if ch.name == "Sumit":
                    self.ended = True
                    self.ending = im
                    return
                else:
                    # NPC hitting burnout or funding disaster does NOT immediately end the entire sim per se,
                    # but might be interesting to track. We will not end simulation on NPC states.
                    pass

    def total_turns_allowed(self):
        return self.base_turns + self.extra_turns

    def _npc_take_actions(self, ch: Character):
        # NPC distributes current energy according to policy
        if ch.energy < GLOBAL["min_energy_for_action"]:
            # can't do anything, auto rest
            action_rest(ch)
            return
        policy = ch.policy
        # allocate energy according to policy fractions
        # ensure keys present
        frac_map = {k: policy.get(k, 0.0) for k in ["lab", "teach", "rest", "bar"]}
        # normalize fractions if they sum to >1
        s = sum(frac_map.values())
        if s > 1e-9:
            for k in frac_map:
                frac_map[k] = frac_map[k] / s
        else:
            frac_map = {"rest": 1.0}
        total = int(round(ch.energy))
        alloc = allocate_energy_integer(total, frac_map)
        # perform actions in order: lab, teach, bar, rest
        if alloc.get("lab", 0) > 0:
            action_lab(ch, alloc["lab"])
        if alloc.get("teach", 0) > 0:
            action_teach(ch, alloc["teach"])
        if alloc.get("bar", 0) > 0:
            action_bar(ch, alloc["bar"])
        # rest: we implement rest as a full-turn rest if they allocate to rest; it doesn't spend energy
        if alloc.get("rest", 0) > 0:
            action_rest(ch)
        # small passive clamp
        ch.clamp()

    def _auto_player_turn(self, ch: Character):
        # Simple heuristic policy for Sumit (used for Monte-Carlo)
        # - If turn >=9 and extra_turns < max_extra_turns and ch.energy >= apply_energy_cost, spend energy to extend
        # - If energy <= 5 -> prefer rest (or bar sometimes)
        # - If progress < 100 and funding > 5 -> prioritize lab
        # - If reputation < 80 and progress >= 60 -> do teach to top reputation
        # - else randomize between lab/teach/rest with mild bias to lab
        if ch.energy < GLOBAL["min_energy_for_action"]:
            action_rest(ch)
            return

        # Attempt to apply for extra turn (only at or after turn 9)
        if self.turn >= 9 and self.extra_turns < GLOBAL["max_extra_turns"] and ch.energy >= GLOBAL["apply_energy_cost"]:
            # heuristic: apply if progress >= 50 or reputation >= 50 or funding > 10 (to try extend)
            if ch.progress >= 50 or ch.reputation >= 50 or ch.funding > 10:
                # spend apply_energy_cost and increase extra_turns by 1
                ch.energy -= GLOBAL["apply_energy_cost"]
                self.extra_turns += 1
                # small rep bump for applying
                ch.reputation += 1.0
                ch.clamp()
                # continue to do remaining actions in this turn
        # energy decision after apply
        if ch.energy <= 0:
            return

        # if energy very low, try rest or bar
        if ch.energy <= 5:
            # 60% rest, 40% bar
            if random.random() < 0.6:
                action_rest(ch)
            else:
                action_bar(ch, 1)
            return

        # if funding is dangerously low, rest or teach to avoid lab spending
        if ch.funding <= 5 and ch.progress < 100:
            # prioritize teach to raise rep and preserve funding
            spend = min(int(round(ch.energy)), 3)
            action_teach(ch, spend)
            # if still has energy, rest
            if ch.energy > 0:
                action_rest(ch)
            return

        # if progress not yet 100, mostly lab
        if ch.progress < 100:
            # use most energy for lab, but leave some for rest/bar occasionally
            lab_spend = int(round(ch.energy * 0.75))
            lab_spend = max(1, lab_spend)
            action_lab(ch, lab_spend)
            # if remains, do small teach or rest
            if ch.energy >= 1:
                # 50% teach 50% rest
                if random.random() < 0.5:
                    action_teach(ch, 1)
                else:
                    action_rest(ch)
            return
        else:
            # progress already 100: try to increase reputation (teach)
            spend = int(round(ch.energy * 0.6))
            if spend >= 1:
                action_teach(ch, spend)
            if ch.energy > 0:
                action_rest(ch)
            return

    def _interactive_player_turn(self, ch: Character):
        # Very basic interactive loop: show stats and prompt for allocation
        print(f"\n--- Turn {self.turn} - {ch.name}'s turn ---")
        print("Stats:", ch.stats())
        print("Enter action for this turn. Options: lab X, teach X, bar X, rest")
        print("You may also type 'apply' to pay {} energy to add +1 turn (only allowed from round 9)".format(GLOBAL["apply_energy_cost"]))
        done = False
        while not done:
            cmd = input("action> ").strip().lower()
            if cmd.startswith("lab"):
                parts = cmd.split()
                qty = int(parts[1]) if len(parts) > 1 else int(round(ch.energy))
                qty = min(qty, int(round(ch.energy)))
                action_lab(ch, qty)
                done = True
            elif cmd.startswith("teach"):
                parts = cmd.split()
                qty = int(parts[1]) if len(parts) > 1 else int(round(ch.energy))
                qty = min(qty, int(round(ch.energy)))
                action_teach(ch, qty)
                done = True
            elif cmd.startswith("bar"):
                parts = cmd.split()
                qty = int(parts[1]) if len(parts) > 1 else 1
                qty = min(qty, int(round(ch.energy)))
                action_bar(ch, qty)
                done = True
            elif cmd == "rest":
                action_rest(ch)
                done = True
            elif cmd == "apply":
                if self.turn >= 9 and self.extra_turns < GLOBAL["max_extra_turns"] and ch.energy >= GLOBAL["apply_energy_cost"]:
                    ch.energy -= GLOBAL["apply_energy_cost"]
                    self.extra_turns += 1
                    ch.reputation += 1.0
                    ch.clamp()
                    print("Applied for +1 turn. Remaining energy:", ch.energy)
                else:
                    print("Cannot apply now.")
            else:
                print("Unknown command. Try again.")
        print("After action:", ch.stats())

    def run_to_end(self):
        # runs until turn limit or until Sumit triggers immediate end (burnout/funding disaster)
        while (self.turn < self.total_turns_allowed()) and not self.ended:
            self.run_one_turn()
        # After loop, if not already ended by immediate condition, evaluate final ending
        player = self.by_name["Sumit"]
        # check immediate ending one more time
        im = check_immediate_ending(player)
        if im:
            self.ending = im
            self.ended = True
            return self.ending, player
        # if funding <=0 for player => Funding Disaster per priority
        if player.funding <= 0 and player.energy > 0:
            self.ending = "Funding Disaster"
            self.ended = True
            return self.ending, player
        # final judgement
        self.ending = final_ending_for_player(player)
        self.ended = True
        return self.ending, player

# ---------------------------
# Simulator: run many games and produce stats
# ---------------------------
def simulate_games(runs=2000, seed=None, mode="auto", verbose=False):
    if seed is not None:
        random.seed(seed)
    outcomes = Counter()
    final_stats = []
    for i in range(runs):
        g = Game(mode=mode)
        ending, player = g.run_to_end()
        outcomes[ending] += 1
        final_stats.append(player.stats())
        if verbose and (i % max(1, runs // 10) == 0):
            print(f"Sim {i}/{runs}: {ending}")
    # aggregate
    summary = {k: (v, v / runs) for k, v in outcomes.items()}
    # compute some numeric summaries for player final states
    progs = [s["progress"] for s in final_stats]
    reps = [s["reputation"] for s in final_stats]
    funds = [s["funding"] for s in final_stats]
    energies = [s["energy"] for s in final_stats]
    stats = {
        "outcomes": summary,
        "progress_mean": statistics.mean(progs) if progs else 0,
        "reputation_mean": statistics.mean(reps) if reps else 0,
        "funding_mean": statistics.mean(funds) if funds else 0,
        "energy_mean": statistics.mean(energies) if energies else 0,
    }
    return stats

# ---------------------------
# Main CLI
# ---------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=2000, help="Number of Monte-Carlo runs")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--mode", choices=["auto", "interactive"], default="auto", help="auto or interactive")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.mode == "interactive":
        # single interactive game
        g = Game(mode="interactive")
        ending, player = g.run_to_end()
        print("\n=== Game ended ===")
        print("Ending:", ending)
        print("Final player stats:", player.stats())
        return

    print(f"Running {args.runs} automated simulations (mode=auto) ...")
    stats = simulate_games(runs=args.runs, seed=args.seed, mode="auto", verbose=args.verbose)
    print("\n=== Simulation summary ===")
    for k, (count, frac) in sorted(stats["outcomes"].items(), key=lambda x: -x[1][0]):
        print(f"{k:20s} : {count} ({frac*100:.2f}%)")
    print("\nMeans - progress: {:.2f}, reputation: {:.2f}, funding: {:.2f}, energy: {:.2f}".format(
        stats["progress_mean"], stats["reputation_mean"], stats["funding_mean"], stats["energy_mean"]
    ))

if __name__ == "__main__":
    main()
