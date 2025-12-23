# app/tally.py
from collections import defaultdict

def irvTally(ballots: list[list[str]], optionIds: list[str]) -> dict:
    remaining = set(optionIds)
    rounds = []
    roundNumber = 0

    while True:
        roundNumber += 1
        totals = defaultdict(int)
        exhausted = 0

        for ranking in ballots:
            selected = None
            for optionId in ranking:
                if optionId in remaining:
                    selected = optionId
                    break

            if selected is None:
                exhausted += 1
            else:
                totals[selected] += 1

        for optionId in remaining:
            totals.setdefault(optionId, 0)

        activeVotes = sum(totals[o] for o in remaining)

        if activeVotes == 0:
            rounds.append({
                "round": roundNumber,
                "totals": dict(totals),
                "eliminated": None,
                "exhausted": exhausted,
            })
            return {"winnerOptionId": None, "rounds": rounds}

        for optionId in remaining:
            if totals[optionId] > activeVotes / 2:
                rounds.append({
                    "round": roundNumber,
                    "totals": dict(totals),
                    "eliminated": None,
                    "exhausted": exhausted,
                })
                return {"winnerOptionId": optionId, "rounds": rounds}

        minVotes = min(totals[o] for o in remaining)
        eliminated = sorted(
            [o for o in remaining if totals[o] == minVotes]
        )[0]

        rounds.append({
            "round": roundNumber,
            "totals": dict(totals),
            "eliminated": eliminated,
            "exhausted": exhausted,
        })

        remaining.remove(eliminated)

        if len(remaining) == 1:
            return {
                "winnerOptionId": next(iter(remaining)),
                "rounds": rounds,
            }
