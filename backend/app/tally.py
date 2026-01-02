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
            # Don't automatically declare winner - verify they have >50%
            # This handles the edge case of a 50-50 tie where we eliminated
            # one candidate alphabetically but the remaining candidate doesn't
            # actually have a majority
            lastCandidate = next(iter(remaining))
            lastCandidateVotes = totals[lastCandidate]
            
            # Recalculate active votes after elimination
            # (some votes may have exhausted when their candidate was eliminated)
            roundNumber += 1
            finalTotals = defaultdict(int)
            finalExhausted = 0
            
            for ranking in ballots:
                selected = None
                for optionId in ranking:
                    if optionId in remaining:
                        selected = optionId
                        break
                
                if selected is None:
                    finalExhausted += 1
                else:
                    finalTotals[selected] += 1
            
            for optionId in remaining:
                finalTotals.setdefault(optionId, 0)
            
            activeVotes = sum(finalTotals[o] for o in remaining)
            
            if activeVotes == 0:
                # All votes exhausted
                rounds.append({
                    "round": roundNumber,
                    "totals": dict(finalTotals),
                    "eliminated": None,
                    "exhausted": finalExhausted,
                })
                return {"winnerOptionId": None, "rounds": rounds}
            
            # Check if last candidate has true majority (>50%)
            if finalTotals[lastCandidate] > activeVotes / 2:
                rounds.append({
                    "round": roundNumber,
                    "totals": dict(finalTotals),
                    "eliminated": None,
                    "exhausted": finalExhausted,
                })
                return {
                    "winnerOptionId": lastCandidate,
                    "rounds": rounds,
                }
            else:
                # Edge case: 50-50 tie or all votes exhausted
                # In true IRV, this is a tie - no winner
                rounds.append({
                    "round": roundNumber,
                    "totals": dict(finalTotals),
                    "eliminated": None,
                    "exhausted": finalExhausted,
                })
                return {"winnerOptionId": None, "rounds": rounds}
