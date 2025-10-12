INSERT INTO teams (id, name, coach, city)
VALUES
    (1, 'Sharks', 'Laura Martínez', 'Valencia'),
    (2, 'Falcons', 'Diego Herrera', 'Madrid'),
    (3, 'Titans', 'María Gómez', 'Bilbao'),
    (4, 'Warriors', 'Javier Ruiz', 'Barcelona')
ON CONFLICT (id) DO NOTHING;
