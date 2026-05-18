players = [
    {"id": "p1", "name": "Batter One", "team": "Team A", "role": "Batter"},
    {"id": "p2", "name": "Bowler One", "team": "Team B", "role": "Bowler"},
    {"id": "p3", "name": "Batter Two", "team": "Team A", "role": "Batter"},
    {"id": "p4", "name": "Bowler Two", "team": "Team B", "role": "Bowler"},
]

match_context = {"team1": "Team A", "team2": "Team B", "venue": "City Stadium"}


def get_live_match_context():
    return {
        "match": match_context,
        "activeBatter": players[2],  # SRH batter (currently batting team)
        "activeBowler": players[1],  # CSK bowler
    }
