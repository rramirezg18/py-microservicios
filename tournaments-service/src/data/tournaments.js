const tournaments = [
  {
    id: 'cup-2024',
    code: 'TOUR-CUP',
    name: 'Tournament Cup 2024',
    heroTitle: 'TOURNAMENT CUP',
    season: 'Temporada 2024',
    location: 'Ciudad de México, MX',
    venue: 'Arena Metropolitana',
    startDateUtc: '2024-07-12T19:00:00Z',
    endDateUtc: '2024-07-19T21:00:00Z',
    updatedAtUtc: '2024-07-20T03:15:00Z',
    description:
      'La copa que reúne a los mejores equipos del país en un formato de eliminación directa con ambiente de final continental.',
    domain: 'https://www.tournamentcup.mx',
    teams: [
      {
        id: 'cup-lions',
        name: 'Lions',
        shortName: 'LIO',
        city: 'Monterrey',
        coach: 'Ricardo Ortega',
        seed: 1,
        record: '18-2',
        ranking: 1,
        streak: 'Racha +5',
        palette: { primary: '#f97316', secondary: '#fb923c' },
        narrative:
          'Los Lions llegan como primer sembrado tras dominar la fase regular con ofensiva explosiva y defensa asfixiante.',
        players: ['A. Johnson', 'M. Álvarez', 'J. Ríos', 'D. Carter', 'L. Mendoza'],
        stats: [
          { label: 'PPG', value: '96.3' },
          { label: 'Rebotes', value: '41.2' },
          { label: 'Dif. Pts', value: '+124' }
        ]
      },
      {
        id: 'cup-tigers',
        name: 'Tigers',
        shortName: 'TIG',
        city: 'Guadalajara',
        coach: 'Héctor Luna',
        seed: 8,
        record: '11-9',
        ranking: 8,
        streak: 'Racha -1',
        palette: { primary: '#facc15', secondary: '#fde047' },
        narrative: 'Un equipo aguerrido que apuesta por el ritmo alto y triples desde las esquinas.',
        players: ['R. Castillo', 'I. Thomas', 'C. García', 'P. Soto', 'E. Núñez'],
        stats: [
          { label: 'PPG', value: '87.6' },
          { label: 'Triples', value: '37%' },
          { label: 'Asistencias', value: '22.1' }
        ]
      },
      {
        id: 'cup-eagles',
        name: 'Eagles',
        shortName: 'EAG',
        city: 'Puebla',
        coach: 'Luis Ferrer',
        seed: 4,
        record: '15-5',
        ranking: 4,
        streak: 'Racha +2',
        palette: { primary: '#38bdf8', secondary: '#0ea5e9' },
        narrative: 'Fase regular impecable volando desde la defensa presionante y transiciones rápidas.',
        players: ['B. Hernández', 'G. Wallace', 'T. Pérez', 'S. Molina', 'O. Chávez'],
        stats: [
          { label: 'PPG', value: '90.1' },
          { label: 'Robos', value: '10.4' },
          { label: 'Bloqueos', value: '5.0' }
        ]
      },
      {
        id: 'cup-sharks',
        name: 'Sharks',
        shortName: 'SHA',
        city: 'Veracruz',
        coach: 'Víctor Andrade',
        seed: 5,
        record: '14-6',
        ranking: 5,
        streak: 'Racha +4',
        palette: { primary: '#0f172a', secondary: '#38bdf8' },
        narrative: 'Un cuadro físico y disciplinado que castiga en la pintura y controla los tableros.',
        players: ['E. McKenzie', 'H. Torres', 'M. Díaz', 'J. Vázquez', 'C. Lewis'],
        stats: [
          { label: 'PPG', value: '88.7' },
          { label: 'Rebotes', value: '45.3' },
          { label: 'Tapones', value: '6.2' }
        ]
      },
      {
        id: 'cup-bulls',
        name: 'Bulls',
        shortName: 'BUL',
        city: 'CDMX',
        coach: 'Esteban Serrano',
        seed: 2,
        record: '17-3',
        ranking: 2,
        streak: 'Racha +3',
        palette: { primary: '#ef4444', secondary: '#f87171' },
        narrative: 'Plantel con experiencia internacional que sabe cerrar partidos apretados.',
        players: ['C. Williams', 'A. Ramírez', 'J. Ortiz', 'N. Brown', 'S. Ibáñez'],
        stats: [
          { label: 'PPG', value: '94.8' },
          { label: 'Asistencias', value: '24.6' },
          { label: 'Pérdidas', value: '11.0' }
        ]
      },
      {
        id: 'cup-hawks',
        name: 'Hawks',
        shortName: 'HAW',
        city: 'Tijuana',
        coach: 'Marco Elizalde',
        seed: 7,
        record: '12-8',
        ranking: 7,
        streak: 'Racha +1',
        palette: { primary: '#14b8a6', secondary: '#2dd4bf' },
        narrative: 'Atacan con alas abiertas: mucha corrida, manos activas y triples de transición.',
        players: ['L. Foster', 'M. Luna', 'A. Vega', 'H. Calderón', 'D. Rangel'],
        stats: [
          { label: 'PPG', value: '89.5' },
          { label: 'Robos', value: '11.2' },
          { label: 'Triples', value: '35%' }
        ]
      },
      {
        id: 'cup-wolves',
        name: 'Wolves',
        shortName: 'WOL',
        city: 'Chihuahua',
        coach: 'Ramiro Padilla',
        seed: 6,
        record: '13-7',
        ranking: 6,
        streak: 'Racha -2',
        palette: { primary: '#9333ea', secondary: '#a855f7' },
        narrative: 'Juego interior poderoso con postes dominantes y bases pacientes.',
        players: ['G. Bishop', 'C. Herrera', 'K. López', 'I. Flores', 'R. Silva'],
        stats: [
          { label: 'PPG', value: '86.2' },
          { label: 'Rebotes', value: '47.1' },
          { label: 'Bloqueos', value: '5.8' }
        ]
      },
      {
        id: 'cup-falcons',
        name: 'Falcons',
        shortName: 'FAL',
        city: 'Cancún',
        coach: 'Óscar Medina',
        seed: 3,
        record: '16-4',
        ranking: 3,
        streak: 'Racha +6',
        palette: { primary: '#22d3ee', secondary: '#67e8f9' },
        narrative: 'Sorprendieron con un perímetro letal y defensa combinada.',
        players: ['P. Harper', 'V. Ríos', 'J. Cárdenas', 'U. Méndez', 'A. Lugo'],
        stats: [
          { label: 'PPG', value: '91.0' },
          { label: 'Triples', value: '39%' },
          { label: 'Asistencias', value: '23.4' }
        ]
      }
    ],
    matches: [
      {
        id: 'cup-a1',
        label: 'Cuartos · Juego 1',
        round: 'group',
        status: 'finished',
        scheduledAtUtc: '2024-07-12T19:00:00Z',
        venue: 'Arena Norte',
        groupId: 'A',
        teamAId: 'cup-lions',
        teamBId: 'cup-tigers',
        scoreA: 92,
        scoreB: 88,
        next: [{ matchId: 'cup-semi-a', slot: 'teamA' }]
      },
      {
        id: 'cup-a2',
        label: 'Cuartos · Juego 2',
        round: 'group',
        status: 'finished',
        scheduledAtUtc: '2024-07-13T19:00:00Z',
        venue: 'Arena Norte',
        groupId: 'A',
        teamAId: 'cup-eagles',
        teamBId: 'cup-sharks',
        scoreA: 84,
        scoreB: 91,
        next: [{ matchId: 'cup-semi-a', slot: 'teamB' }]
      },
      {
        id: 'cup-b1',
        label: 'Cuartos · Juego 3',
        round: 'group',
        status: 'finished',
        scheduledAtUtc: '2024-07-14T19:00:00Z',
        venue: 'Arena Sur',
        groupId: 'B',
        teamAId: 'cup-bulls',
        teamBId: 'cup-hawks',
        scoreA: 99,
        scoreB: 90,
        next: [{ matchId: 'cup-semi-b', slot: 'teamA' }]
      },
      {
        id: 'cup-b2',
        label: 'Cuartos · Juego 4',
        round: 'group',
        status: 'finished',
        scheduledAtUtc: '2024-07-14T21:30:00Z',
        venue: 'Arena Sur',
        groupId: 'B',
        teamAId: 'cup-wolves',
        teamBId: 'cup-falcons',
        scoreA: 86,
        scoreB: 95,
        next: [{ matchId: 'cup-semi-b', slot: 'teamB' }]
      },
      {
        id: 'cup-semi-a',
        label: 'Semi-Final 1',
        round: 'semi',
        status: 'finished',
        scheduledAtUtc: '2024-07-16T20:30:00Z',
        venue: 'Arena Metropolitana',
        groupId: 'A',
        teamAId: 'cup-lions',
        teamBId: 'cup-sharks',
        teamAOrigin: 'Ganador Cuartos A1',
        teamBOrigin: 'Ganador Cuartos A2',
        scoreA: 97,
        scoreB: 101,
        next: [{ matchId: 'cup-final', slot: 'teamA' }]
      },
      {
        id: 'cup-semi-b',
        label: 'Semi-Final 2',
        round: 'semi',
        status: 'finished',
        scheduledAtUtc: '2024-07-17T20:30:00Z',
        venue: 'Arena Metropolitana',
        groupId: 'B',
        teamAId: 'cup-bulls',
        teamBId: 'cup-falcons',
        teamAOrigin: 'Ganador Cuartos B1',
        teamBOrigin: 'Ganador Cuartos B2',
        scoreA: 102,
        scoreB: 98,
        next: [{ matchId: 'cup-final', slot: 'teamB' }]
      },
      {
        id: 'cup-final',
        label: 'Gran Final',
        round: 'final',
        status: 'finished',
        scheduledAtUtc: '2024-07-19T21:00:00Z',
        venue: 'Arena Metropolitana',
        teamAId: 'cup-sharks',
        teamBId: 'cup-bulls',
        teamAOrigin: 'Ganador Semi 1',
        teamBOrigin: 'Ganador Semi 2',
        scoreA: 94,
        scoreB: 96,
        next: []
      }
    ],
    groups: [
      {
        id: 'A',
        name: 'Group A',
        color: 'linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(59, 130, 246, 0.22))',
        initialMatchIds: ['cup-a1', 'cup-a2'],
        semiFinalMatchId: 'cup-semi-a'
      },
      {
        id: 'B',
        name: 'Group B',
        color: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(20, 184, 166, 0.22))',
        initialMatchIds: ['cup-b1', 'cup-b2'],
        semiFinalMatchId: 'cup-semi-b'
      }
    ],
    finalMatchId: 'cup-final'
  },
  {
    id: 'legends-2025',
    code: 'LEG-CUP',
    name: 'Legends Invitational 2025',
    heroTitle: 'LEGENDS CUP',
    season: 'Temporada 2025',
    location: 'Monterrey, MX',
    venue: 'Arena Fundidora',
    startDateUtc: '2025-02-02T18:00:00Z',
    endDateUtc: '2025-02-10T20:00:00Z',
    updatedAtUtc: '2025-02-06T03:00:00Z',
    description:
      'Invitacional internacional con transmisiones en tiempo real, analítica avanzada y cobertura 360 para fans.',
    domain: 'https://legendscup.gg',
    teams: [
      {
        id: 'leg-ravens',
        name: 'Ravens',
        shortName: 'RAV',
        city: 'Austin',
        coach: 'Dana Mitchell',
        seed: 1,
        record: '20-4',
        ranking: 1,
        streak: 'Racha +8',
        palette: { primary: '#0ea5e9', secondary: '#38bdf8' },
        narrative: 'Plantel con ritmo europeo que prioriza pases extra y defensas combinadas.',
        players: ['S. Carter', 'I. Romero', 'K. Daniels', 'H. Fischer', 'A. Scott'],
        stats: [
          { label: 'PPG', value: '95.4' },
          { label: 'Asistencias', value: '25.0' },
          { label: 'Robos', value: '9.1' }
        ]
      },
      {
        id: 'leg-lynx',
        name: 'Lynx',
        shortName: 'LYX',
        city: 'Bogotá',
        coach: 'Jaime Cuadrado',
        seed: 8,
        record: '12-10',
        ranking: 8,
        streak: 'Racha -1',
        palette: { primary: '#22c55e', secondary: '#4ade80' },
        narrative: 'Roster joven con piernas frescas y presión a toda la cancha.',
        players: ['T. Ramírez', 'P. Young', 'C. Díaz', 'L. Duarte', 'M. Ibargüen'],
        stats: [
          { label: 'PPG', value: '86.9' },
          { label: 'Robos', value: '11.4' },
          { label: 'Rebotes', value: '39.6' }
        ]
      },
      {
        id: 'leg-kings',
        name: 'Kings',
        shortName: 'KIN',
        city: 'Madrid',
        coach: 'Álvaro Ruiz',
        seed: 4,
        record: '17-7',
        ranking: 4,
        streak: 'Racha +3',
        palette: { primary: '#f59e0b', secondary: '#fbbf24' },
        narrative: 'Domino en media cancha con juego colectivo y lectura táctica.',
        players: ['D. Martín', 'J. Aguilar', 'N. Costa', 'R. Méndez', 'P. Varela'],
        stats: [
          { label: 'PPG', value: '90.4' },
          { label: 'Asistencias', value: '24.3' },
          { label: 'Tapones', value: '5.7' }
        ]
      },
      {
        id: 'leg-orioles',
        name: 'Orioles',
        shortName: 'ORI',
        city: 'San Diego',
        coach: 'Tessa Bell',
        seed: 5,
        record: '16-8',
        ranking: 5,
        streak: 'Racha +1',
        palette: { primary: '#f97316', secondary: '#fb923c' },
        narrative: 'Juego perimetral con mucha movilidad y bloqueos indirectos agresivos.',
        players: ['L. Baker', 'E. Costa', 'M. Paredes', 'J. Holmes', 'C. Navarro'],
        stats: [
          { label: 'PPG', value: '88.1' },
          { label: 'Triples', value: '38%' },
          { label: 'Rebotes', value: '40.8' }
        ]
      },
      {
        id: 'leg-giants',
        name: 'Giants',
        shortName: 'GIA',
        city: 'Buenos Aires',
        coach: 'Hugo Sosa',
        seed: 2,
        record: '19-5',
        ranking: 2,
        streak: 'Racha +4',
        palette: { primary: '#ef4444', secondary: '#f97316' },
        narrative: 'Potencia física interior con postes dominantes y rotaciones compactas.',
        players: ['M. Herrera', 'F. Gómez', 'A. Richards', 'I. Suárez', 'G. Antelo'],
        stats: [
          { label: 'PPG', value: '92.7' },
          { label: 'Rebotes', value: '48.9' },
          { label: 'Bloqueos', value: '6.5' }
        ]
      },
      {
        id: 'leg-panthers',
        name: 'Panthers',
        shortName: 'PAN',
        city: 'Lisboa',
        coach: 'Filipa Mendes',
        seed: 7,
        record: '13-11',
        ranking: 7,
        streak: 'Racha 0',
        palette: { primary: '#6366f1', secondary: '#8b5cf6' },
        narrative: 'Defensa híbrida que confunde rivales con zonas y presiones mixtas.',
        players: ['S. Almeida', 'R. Duarte', 'P. Costa', 'Y. Figueroa', 'C. Vieira'],
        stats: [
          { label: 'PPG', value: '84.5' },
          { label: 'Robos', value: '10.9' },
          { label: 'Asistencias', value: '21.7' }
        ]
      },
      {
        id: 'leg-storm',
        name: 'Storm',
        shortName: 'STM',
        city: 'Toronto',
        coach: 'Elliot Hayes',
        seed: 6,
        record: '15-9',
        ranking: 6,
        streak: 'Racha +2',
        palette: { primary: '#0f172a', secondary: '#38bdf8' },
        narrative: 'Relámpagos desde el perímetro con bases desequilibrantes y manos rápidas.',
        players: ['T. Brown', 'J. Campbell', 'K. Watanabe', 'O. Clarkson', 'S. Barrett'],
        stats: [
          { label: 'PPG', value: '89.3' },
          { label: 'Triples', value: '36%' },
          { label: 'Robos', value: '10.3' }
        ]
      },
      {
        id: 'leg-titans',
        name: 'Titans',
        shortName: 'TIT',
        city: 'Miami',
        coach: 'Carla Summers',
        seed: 3,
        record: '18-6',
        ranking: 3,
        streak: 'Racha +5',
        palette: { primary: '#f472b6', secondary: '#f9a8d4' },
        narrative: 'Un equipo versátil que domina con small-ball, presión y spacing perfecto.',
        players: ['Z. Allen', 'K. Martínez', 'F. Campos', 'Y. Porter', 'A. Holloway'],
        stats: [
          { label: 'PPG', value: '93.5' },
          { label: 'Asistencias', value: '24.9' },
          { label: 'Triples', value: '40%' }
        ]
      }
    ],
    matches: [
      {
        id: 'leg-a1',
        label: 'Cuartos · Juego 1',
        round: 'group',
        status: 'finished',
        scheduledAtUtc: '2025-02-02T18:00:00Z',
        venue: 'Arena Fundidora',
        groupId: 'A',
        teamAId: 'leg-ravens',
        teamBId: 'leg-lynx',
        scoreA: 101,
        scoreB: 88,
        next: [{ matchId: 'leg-semi-a', slot: 'teamA' }]
      },
      {
        id: 'leg-a2',
        label: 'Cuartos · Juego 2',
        round: 'group',
        status: 'live',
        scheduledAtUtc: '2025-02-03T18:00:00Z',
        venue: 'Arena Fundidora',
        groupId: 'A',
        teamAId: 'leg-kings',
        teamBId: 'leg-orioles',
        scoreA: 67,
        scoreB: 71,
        next: [{ matchId: 'leg-semi-a', slot: 'teamB' }]
      },
      {
        id: 'leg-b1',
        label: 'Cuartos · Juego 3',
        round: 'group',
        status: 'scheduled',
        scheduledAtUtc: '2025-02-04T18:00:00Z',
        venue: 'Arena Fundidora',
        groupId: 'B',
        teamAId: 'leg-giants',
        teamBId: 'leg-panthers',
        scoreA: null,
        scoreB: null,
        next: [{ matchId: 'leg-semi-b', slot: 'teamA' }]
      },
      {
        id: 'leg-b2',
        label: 'Cuartos · Juego 4',
        round: 'group',
        status: 'scheduled',
        scheduledAtUtc: '2025-02-04T20:30:00Z',
        venue: 'Arena Fundidora',
        groupId: 'B',
        teamAId: 'leg-storm',
        teamBId: 'leg-titans',
        scoreA: null,
        scoreB: null,
        next: [{ matchId: 'leg-semi-b', slot: 'teamB' }]
      },
      {
        id: 'leg-semi-a',
        label: 'Semi-Final 1',
        round: 'semi',
        status: 'scheduled',
        scheduledAtUtc: '2025-02-07T19:30:00Z',
        venue: 'Arena Fundidora',
        groupId: 'A',
        teamAId: 'leg-ravens',
        teamBId: null,
        teamAOrigin: 'Ganador Cuartos A1',
        teamBOrigin: 'Ganador Cuartos A2',
        scoreA: null,
        scoreB: null,
        next: [{ matchId: 'leg-final', slot: 'teamA' }]
      },
      {
        id: 'leg-semi-b',
        label: 'Semi-Final 2',
        round: 'semi',
        status: 'scheduled',
        scheduledAtUtc: '2025-02-08T19:30:00Z',
        venue: 'Arena Fundidora',
        groupId: 'B',
        teamAId: null,
        teamBId: null,
        teamAOrigin: 'Ganador Cuartos B1',
        teamBOrigin: 'Ganador Cuartos B2',
        scoreA: null,
        scoreB: null,
        next: [{ matchId: 'leg-final', slot: 'teamB' }]
      },
      {
        id: 'leg-final',
        label: 'Gran Final',
        round: 'final',
        status: 'scheduled',
        scheduledAtUtc: '2025-02-10T20:00:00Z',
        venue: 'Arena Fundidora',
        teamAId: null,
        teamBId: null,
        teamAOrigin: 'Ganador Semi 1',
        teamBOrigin: 'Ganador Semi 2',
        scoreA: null,
        scoreB: null,
        next: []
      }
    ],
    groups: [
      {
        id: 'A',
        name: 'Group A',
        color: 'linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(249, 115, 22, 0.2))',
        initialMatchIds: ['leg-a1', 'leg-a2'],
        semiFinalMatchId: 'leg-semi-a'
      },
      {
        id: 'B',
        name: 'Group B',
        color: 'linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(236, 72, 153, 0.2))',
        initialMatchIds: ['leg-b1', 'leg-b2'],
        semiFinalMatchId: 'leg-semi-b'
      }
    ],
    finalMatchId: 'leg-final'
  }
];

module.exports = { tournaments };
