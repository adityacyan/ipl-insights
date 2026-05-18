# Sample API response for testing when live API is not available
SAMPLE_CRICBUZZ_RESPONSE = {
    "typeMatches": [
        {
            "matchType": "League",
            "seriesMatches": [
                {
                    "seriesAdWrapper": {
                        "seriesId": 9241,
                        "seriesName": "Indian Premier League 2026",
                        "matches": [
                            {
                                "matchInfo": {
                                    "matchId": 152196,
                                    "seriesId": 9241,
                                    "seriesName": "Indian Premier League 2026",
                                    "matchDesc": "63rd Match",
                                    "matchFormat": "T20",
                                    "startDate": "1779112800000",
                                    "endDate": "1779125400000",
                                    "state": "In Progress",
                                    "status": "Sunrisers Hyderabad need 146 runs in 95 balls",
                                    "team1": {
                                        "teamId": 58,
                                        "teamName": "Chennai Super Kings",
                                        "teamSName": "CSK",
                                        "imageId": 860038
                                    },
                                    "team2": {
                                        "teamId": 255,
                                        "teamName": "Sunrisers Hyderabad",
                                        "teamSName": "SRH",
                                        "imageId": 860066
                                    },
                                    "venueInfo": {
                                        "id": 11,
                                        "ground": "MA Chidambaram Stadium",
                                        "city": "Chennai",
                                        "timezone": "+05:30",
                                        "latitude": "13.06282",
                                        "longitude": "80.279274"
                                    },
                                    "currBatTeamId": 255,
                                    "seriesStartDt": "1774656000000",
                                    "seriesEndDt": "1780358400000",
                                    "isTimeAnnounced": True,
                                    "stateTitle": "In Progress",
                                    "isFantasyEnabled": True
                                },
                                "matchScore": {
                                    "team1Score": {
                                        "inngs1": {
                                            "inningsId": 1,
                                            "runs": 180,
                                            "wickets": 7,
                                            "overs": 19.6
                                        }
                                    },
                                    "team2Score": {
                                        "inngs1": {
                                            "inningsId": 2,
                                            "runs": 35,
                                            "wickets": 1,
                                            "overs": 4.1
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            ]
        }
    ],
    "responseLastUpdated": "1779122038"
}