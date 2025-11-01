from collections.abc import Iterable
from io import BytesIO
from typing import Any, Optional
from datetime import datetime

from reportlab.lib import colors, pagesizes
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _doc(buf: BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buf,
        pagesize=pagesizes.A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Reportes",
        author="report-service",
    )

def _styles():
    s = getSampleStyleSheet()
    title = ParagraphStyle("TitleBig", parent=s["Title"], fontSize=18, leading=22, alignment=TA_CENTER, spaceAfter=10)
    h2 = ParagraphStyle("H2", parent=s["Heading2"], spaceBefore=10, spaceAfter=6)
    normal = ParagraphStyle("Normal", parent=s["Normal"], alignment=TA_LEFT, fontSize=10, leading=13)
    return title, h2, normal

def _table(data: list[list[Any]], col_widths: list[float] | None = None) -> Table:
    t = Table(data, colWidths=col_widths or "100%")
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t

def _safe(d: dict[str, Any], *keys: str, default: str = "-") -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default

def _fmt_short_dt(raw: Any) -> str:
    if raw is None:
        return "-"
    s = str(raw)
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        if "T" in s:
            return s.split("T", 1)[0]
        return s

# ------------------- BUILDERS -------------------

def build_pdf_teams(teams: Iterable[dict[str, Any]]) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, _, normal = _styles()
    rows: list[list[Any]] = [["ID", "Name", "City", "Coach"]]
    for t in teams:
        if not isinstance(t, dict):
            continue
        rows.append([
            _safe(t, "id", "Id", "teamId", "TeamId", default="-"),
            _safe(t, "name", "Name", "teamName", "TeamName", default="-"),
            _safe(t, "city", "City", "location", "Location", default="-"),
            _safe(t, "coach", "Coach", "manager", "Manager", default="-"),
        ])
    story: list[Any] = [
        Paragraph("Listado de Equipos", title),
        Spacer(1, 6),
        Paragraph(f"Total: {len(rows)-1}", normal),
        Spacer(1, 8),
        _table(rows, col_widths=[50, 220, 150, 130]),
    ]
    doc.build(story)
    return buf.getvalue()

def build_pdf_players_by_team(team_id: str, players: Iterable[dict[str, Any]], team_name: str | None=None) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, _, normal = _styles()
    rows: list[list[Any]] = [["#", "Player", "Age", "Position"]]
    for i, p in enumerate(players, 1):
        if not isinstance(p, dict): continue
        rows.append([i, _safe(p, "name", "Name", default=""),
                        _safe(p, "age", "Age", default="-"),
                        _safe(p, "position", "Position", default="")])
    titulo = f"Jugadores del Equipo {team_name}  (#{team_id})" if team_name else f"Jugadores del Equipo #{team_id}"
    story: list[Any] = [Paragraph(titulo, title), Spacer(1, 6),
                        Paragraph(f"Total: {len(rows)-1}", normal),
                        Spacer(1, 8), _table(rows, col_widths=[28, 260, 70, 140])]
    doc.build(story); return buf.getvalue()

def build_pdf_all_players(players: Iterable[dict[str, Any]], team_name_by_id: dict[str, str]) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, _, normal = _styles()
    rows: list[list[Any]] = [["#", "Player", "Team", "Age", "Position"]]
    for i, p in enumerate(players, 1):
        if not isinstance(p, dict): continue
        team_id = str(_safe(p, "team_id", "teamId", "TeamId", default=""))
        team_name = team_name_by_id.get(team_id, team_id or "-")
        rows.append([i, _safe(p, "name", "Name", default=""), team_name,
                        _safe(p, "age", "Age", default="-"),
                        _safe(p, "position", "Position", default="")])
    story: list[Any] = [Paragraph("Jugadores Registrados", title), Spacer(1, 6),
                        Paragraph(f"Total: {len(rows)-1}", normal), Spacer(1, 8),
                        _table(rows, col_widths=[28, 180, 170, 60, 130])]
    doc.build(story); return buf.getvalue()

def build_pdf_matches_history(matches, from_, to, teams_map):
    # Usa los helpers locales existentes (_doc, _styles, _table)
    buf = BytesIO()
    doc = _doc(buf)
    title, _, normal = _styles()

    story: list[Any] = [
        Paragraph("Historial de Partidos", title),
        Spacer(1, 6),
    ]

    # Subtítulo (rango)
    if from_ or to:
        story += [Paragraph(f"Rango: {from_ or '—'} a {to or '—'}", normal), Spacer(1, 8)]
    else:
        story += [Spacer(1, 8)]

    # Cabecera de tabla
    rows = [["ID", "Fecha", "Estado", "Local", "Visitante", "Marcador"]]

    if not matches:
        rows.append(["—", "—", "No hay partidos en el rango", "—", "—", "—"])
        story.append(_table(rows, col_widths=[40, 120, 100, 120, 120, 60]))
        doc.build(story)
        return buf.getvalue()

    # Renglones
    for m in matches:
        mid   = m.get("id") or m.get("Id") or "—"
        date  = m.get("dateMatch") or m.get("DateMatch") or m.get("date") or "—"
        stat  = m.get("status") or m.get("Status") or "—"

        home_id = str(m.get("homeTeamId") or m.get("HomeTeamId") or "")
        away_id = str(m.get("awayTeamId") or m.get("AwayTeamId") or "")

        home = teams_map.get(home_id, home_id or "—")
        away = teams_map.get(away_id, away_id or "—")

        hs = m.get("homeScore") or m.get("HomeScore") or 0
        as_ = m.get("awayScore") or m.get("AwayScore") or 0

        rows.append([mid, str(date), str(stat), str(home), str(away), f"{hs} - {as_}"])

    story.append(_table(rows, col_widths=[40, 120, 100, 120, 120, 60]))
    doc.build(story)
    return buf.getvalue()



def build_pdf_match_roster(match_id: str, roster: dict[str, Any]) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, h2, normal = _styles()
    story: list[Any] = [Paragraph(f"Roster del Partido #{match_id}", title), Spacer(1, 8)]

    # Compatibilidad: acepta formato antiguo (homeTeam/awayTeam con players dentro)
    home = roster.get("homeTeam") or roster.get("HomeTeam") or {}
    away = roster.get("awayTeam") or roster.get("AwayTeam") or {}
    home_players_old = home.get("players") or home.get("Players") or []
    away_players_old = away.get("players") or away.get("Players") or []

    # Formato nuevo desde aggregators.match_roster
    match_obj = roster.get("match") or {}
    home_name = _safe(home, "name", "Name", default=_safe(match_obj, "HomeTeamName", default="Local"))
    away_name = _safe(away, "name", "Name", default=_safe(match_obj, "AwayTeamName", default="Visitante"))
    home_players_new = roster.get("homePlayers") or []
    away_players_new = roster.get("awayPlayers") or []

    # Home
    story += [Paragraph(f"{home_name}", h2)]
    home_players = home_players_old if home_players_old else home_players_new
    if home_players:
        rows = [["#", "Player", "Position", "Number/Age"]]
        for i, p in enumerate(home_players, 1):
            if not isinstance(p, dict): continue
            rows.append([i, _safe(p, "name", "Name", default=""),
                           _safe(p, "position", "Position", default=""),
                           _safe(p, "number", "Number", "jersey", "Jersey", "age", "Age", default="")])
        story += [_table(rows), Spacer(1, 6)]
    else:
        story += [Paragraph("Sin detalles de jugadores.", normal), Spacer(1, 6)]

    # Away
    story += [Paragraph(f"{away_name}", h2)]
    away_players = away_players_old if away_players_old else away_players_new
    if away_players:
        rows = [["#", "Player", "Position", "Number/Age"]]
        for i, p in enumerate(away_players, 1):
            if not isinstance(p, dict): continue
            rows.append([i, _safe(p, "name", "Name", default=""),
                           _safe(p, "position", "Position", default=""),
                           _safe(p, "number", "Number", "jersey", "Jersey", "age", "Age", default="")])
        story += [_table(rows), Spacer(1, 6)]
    else:
        story += [Paragraph("Sin detalles de jugadores.", normal), Spacer(1, 6)]

    doc.build(story); return buf.getvalue()

def build_pdf_player_stats(player_id: str, stats: dict[str, Any]) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, _, _ = _styles()
    rows = [["Campo", "Valor"]]
    if isinstance(stats, dict):
        for k, v in stats.items():
            rows.append([str(k), str(v)])
    else:
        rows.append(["-", "-"])
    story: list[Any] = [Paragraph(f"Estadísticas del Jugador #{player_id}", title),
                        Spacer(1, 8), _table(rows)]
    doc.build(story); return buf.getvalue()

def build_pdf_stats_summary(
    title_text: str, rows: list[list[Any]],
    subtitle: Optional[str] = None, col_widths: Optional[list[float]] = None,
) -> list[Any]:
    _, h2, _ = _styles()
    elems: list[Any] = [Paragraph(title_text, h2)]
    if subtitle:
        elems.append(Paragraph(subtitle, getSampleStyleSheet()["Normal"]))
        elems.append(Spacer(1, 4))
    elems.append(_table(rows, col_widths=col_widths))
    elems.append(Spacer(1, 10))
    return elems

def build_pdf_stats_report(sections: list[tuple[str, list[list[Any]]]]) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, _, _ = _styles()
    story: list[Any] = [Paragraph("Resumen de Estadísticas", title), Spacer(1, 8)]
    for title_text, data in sections:
        # 8 columnas => 8 anchos
        story += build_pdf_stats_summary(
            title_text,
            data,
            col_widths=[28, 200, 50, 40, 40, 50, 50, 50]  # ← 8 valores
        )
    doc.build(story)
    return buf.getvalue()


def build_pdf_standings(rows: list[dict[str, Any]]) -> bytes:
    buf = BytesIO(); doc = _doc(buf); title, _, normal = _styles()
    data: list[list[Any]] = [["#", "Equipo", "Victorias"]]
    for i, r in enumerate(rows, 1):
        nombre = str(r.get("name", "")); wins = int(r.get("wins", 0) or 0)
        data.append([i, nombre, wins])
    story: list[Any] = [
        Paragraph("Tabla de Posiciones", title), Spacer(1, 6),
        Paragraph(f"Total: {len(rows)}", normal), Spacer(1, 8),
        _table(data, col_widths=[28, 340, 90]),
    ]
    doc.build(story); return buf.getvalue()
