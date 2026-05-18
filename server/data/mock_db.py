players = [
    {
        'id': 'p1',
        'name': 'Ruturaj Gaikwad',
        'team': 'CSK',
        'role': 'Batter'
    },
    {
        'id': 'p2',
        'name': 'Mustafizur Rahman',
        'team': 'CSK',
        'role': 'Bowler'
    },
    {
        'id': 'p3',
        'name': 'Abhishek Sharma',
        'team': 'SRH',
        'role': 'Batter'
    },
    {
        'id': 'p4',
        'name': 'Pat Cummins',
        'team': 'SRH',
        'role': 'Bowler'
    }
]

match_context = {
    'team1': 'CSK',
    'team2': 'SRH',
    'venue': 'MA Chidambaram Stadium'
}


def get_live_match_context():
    return {
        'match': match_context,
        'activeBatter': players[2],  # SRH batter (currently batting team)
        'activeBowler': players[1]   # CSK bowler
    }
