from collections.abc import Iterable
from datetime import datetime
from io import BytesIO
from typing import Any, Optional

from reportlab.lib import colors, pagesizes
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# -------------------- THEME --------------------
THEME_BG = colors.HexColor("#080E1F")
STRIP_TOP = colors.HexColor("#1D2670")
STRIP_BOTTOM = colors.HexColor("#0B1328")
CARD_BG = colors.HexColor("#111B2E")
ACCENT = colors.HexColor("#6366F1")
ACCENT_SOFT = colors.HexColor("#8B5CF6")
TEXT_PRIMARY = colors.HexColor("#F8FAFC")
TEXT_MUTED = colors.HexColor("#CBD5F5")
GRID_COLOR = colors.HexColor("#1E293B")
ROW_BACKGROUNDS = [colors.HexColor("#101A2D"), colors.HexColor("#0C1322")]
HEADER_TEXT = colors.HexColor("#F5F6FF")


# -------------------- UTILIDADES BASE --------------------
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
    sample = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleBig",
        parent=sample["Title"],
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=10,
        textColor=TEXT_PRIMARY,
        fontName="Helvetica-Bold",
    )
    h2 = ParagraphStyle(
        "H2",
        parent=sample["Heading2"],
        spaceBefore=10,
        spaceAfter=6,
        textColor=TEXT_PRIMARY,
        fontName="Helvetica-Bold",
    )
    normal = ParagraphStyle(
        "Normal",
        parent=sample["Normal"],
        alignment=TA_LEFT,
        fontSize=10,
        leading=13,
        textColor=TEXT_PRIMARY,
    )
    muted = ParagraphStyle(
        "Muted",
        parent=normal,
        fontSize=9,
        leading=12,
        textColor=TEXT_MUTED,
    )
    return title, h2, normal, muted


def _draw_background(pdf_canvas, _doc):
    width, height = pagesizes.A4
    pdf_canvas.saveState()

    pdf_canvas.setFillColor(THEME_BG)
    pdf_canvas.rect(0, 0, width, height, stroke=0, fill=1)

    pdf_canvas.setFillColor(STRIP_TOP)
    pdf_canvas.rect(0, height - 42, width, 42, stroke=0, fill=1)

    pdf_canvas.setFillColor(STRIP_BOTTOM)
    pdf_canvas.rect(0, 0, width, 28, stroke=0, fill=1)

    pdf_canvas.setFillColor(ACCENT_SOFT)
    pdf_canvas.circle(width * 0.82, height * 0.88, 120, stroke=0, fill=1)
    pdf_canvas.restoreState()


def _build(doc: SimpleDocTemplate, story: list[Any]) -> None:
    doc.build(story, onFirstPage=_draw_background, onLaterPages=_draw_background)


def _table(data: list[list[Any]], col_widths: list[float] | None = None) -> Table:
    table = Table(data, colWidths=col_widths or "100%")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("TEXTCOLOR", (0, 0), (-1, 0), HEADER_TEXT),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_PRIMARY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), ROW_BACKGROUNDS),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, GRID_COLOR),
                ("BOX", (0, 0), (-1, -1), 0.35, GRID_COLOR),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _safe(d: dict[str, Any], *keys: str, default: str = "-") -> Any:
    for key in keys:
        if key in d and d[key] not in (None, ""):
            return d[key]
    return default


def _fmt_short_dt(raw: Any) -> str:
    if raw is None:
        return "-"
    value = str(raw)
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        if "T" in value:
            return value.split("T", 1)[0]
        return value


# -------------------- BUILDERS --------------------
def build_pdf_teams(teams: Iterable[dict[str, Any]]) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, muted = _styles()

    rows: list[list[Any]] = [["ID", "Name", "City", "Coach"]]
    for team in teams:
        if not isinstance(team, dict):
            continue
        rows.append(
            [
                _safe(team, "id", "Id", "teamId", "TeamId", default="-"),
                _safe(team, "name", "Name", "teamName", "TeamName", default="-"),
                _safe(team, "city", "City", "location", "Location", default="-"),
                _safe(team, "coach", "Coach", "manager", "Manager", default="-"),
            ]
        )

    story: list[Any] = [
        Paragraph("Listado de Equipos", title),
        Spacer(1, 6),
        Paragraph(f"Total: {len(rows) - 1}", muted),
        Spacer(1, 8),
        _table(rows, col_widths=[50, 220, 150, 130]),
    ]
    _build(doc, story)
    return buf.getvalue()


def build_pdf_players_by_team(
    team_id: str,
    players: Iterable[dict[str, Any]],
    team_name: str | None = None,
) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, muted = _styles()

    rows: list[list[Any]] = [["#", "Player", "Age", "Position"]]
    for index, player in enumerate(players, 1):
        if not isinstance(player, dict):
            continue
        rows.append(
            [
                index,
                _safe(player, "name", "Name", default=""),
                _safe(player, "age", "Age", default="-"),
                _safe(player, "position", "Position", default=""),
            ]
        )

    heading = (
        f"Jugadores del Equipo {team_name} (#{team_id})"
        if team_name
        else f"Jugadores del Equipo #{team_id}"
    )
    story: list[Any] = [
        Paragraph(heading, title),
        Spacer(1, 6),
        Paragraph(f"Total: {len(rows) - 1}", muted),
        Spacer(1, 8),
        _table(rows, col_widths=[28, 260, 70, 140]),
    ]
    _build(doc, story)
    return buf.getvalue()


def build_pdf_all_players(
    players: Iterable[dict[str, Any]],
    team_name_by_id: dict[str, str],
) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, muted = _styles()

    rows: list[list[Any]] = [["#", "Player", "Team", "Age", "Position"]]
    for index, player in enumerate(players, 1):
        if not isinstance(player, dict):
            continue
        team_id = str(_safe(player, "team_id", "teamId", "TeamId", default=""))
        team_name = team_name_by_id.get(team_id, team_id or "-")
        rows.append(
            [
                index,
                _safe(player, "name", "Name", default=""),
                team_name,
                _safe(player, "age", "Age", default="-"),
                _safe(player, "position", "Position", default=""),
            ]
        )

    story: list[Any] = [
        Paragraph("Jugadores Registrados", title),
        Spacer(1, 6),
        Paragraph(f"Total: {len(rows) - 1}", muted),
        Spacer(1, 8),
        _table(rows, col_widths=[28, 190, 170, 60, 80]),
    ]
    _build(doc, story)
    return buf.getvalue()


def build_pdf_matches_history(
    matches: Iterable[dict[str, Any]],
    from_date: Optional[str],
    to_date: Optional[str],
    teams: dict[str, str],
) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, muted = _styles()

    rows: list[list[Any]] = [["#", "Home", "Score", "Away", "Date"]]
    for index, match in enumerate(matches, 1):
        if not isinstance(match, dict):
            continue
        home_id = str(
            match.get("HomeTeamId")
            or match.get("homeTeamId")
            or match.get("home_id")
            or ""
        )
        away_id = str(
            match.get("AwayTeamId")
            or match.get("awayTeamId")
            or match.get("away_id")
            or ""
        )
        home_score = _safe(match, "HomeScore", "homeScore", default="-")
        away_score = _safe(match, "AwayScore", "awayScore", default="-")
        rows.append(
            [
                index,
                teams.get(home_id, home_id or "-"),
                f"{home_score}-{away_score}",
                teams.get(away_id, away_id or "-"),
                _fmt_short_dt(
                    match.get("DateMatch")
                    or match.get("dateMatch")
                    or match.get("date")
                ),
            ]
        )

    story: list[Any] = [Paragraph("Historial de Partidos", title), Spacer(1, 6)]
    if from_date or to_date:
        story += [
            Paragraph(
                f"Rango filtrado: {from_date or '-'} a {to_date or '-'}", muted
            ),
            Spacer(1, 6),
        ]
    story.append(_table(rows, col_widths=[28, 170, 70, 170, 80]))
    _build(doc, story)
    return buf.getvalue()


def build_pdf_match_roster(match_id: str, roster: dict[str, Any]) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, h2, normal, muted = _styles()

    story: list[Any] = [Paragraph(f"Roster del Partido #{match_id}", title), Spacer(1, 6)]

    match = roster.get("match") or {}
    if match:
        home_name = _safe(match, "HomeTeamName", "homeTeamName", default="Local")
        away_name = _safe(match, "AwayTeamName", "awayTeamName", default="Visitante")
        meta_rows = [
            ["Fecha", _fmt_short_dt(match.get("DateMatch") or match.get("dateMatch"))],
            ["Estado", _safe(match, "Status", "status", default="-")],
            [
                "Marcador",
                f"{_safe(match, 'HomeScore', 'homeScore', default='0')} - {_safe(match, 'AwayScore', 'awayScore', default='0')}",
            ],
        ]
        story += [
            _table(meta_rows, col_widths=[120, 320]),
            Spacer(1, 10),
            Paragraph(f"{home_name} vs {away_name}", normal),
            Spacer(1, 8),
        ]

    home = roster.get("homeTeam") or roster.get("HomeTeam") or {}
    away = roster.get("awayTeam") or roster.get("AwayTeam") or {}

    def _team_block(label: str, payload: dict[str, Any]) -> list[Any]:
        block: list[Any] = [Paragraph(label, h2)]
        players = payload.get("players") or payload.get("Players") or []
        if players:
            data = [["#", "Player", "Position", "Number"]]
            for idx, player in enumerate(players, 1):
                if not isinstance(player, dict):
                    continue
                data.append(
                    [
                        idx,
                        _safe(player, "name", "Name", default=""),
                        _safe(player, "position", "Position", default=""),
                        _safe(player, "number", "Number", "jersey", "Jersey", default=""),
                    ]
                )
            block += [_table(data), Spacer(1, 6)]
        else:
            block += [Paragraph("Sin detalles de jugadores.", muted), Spacer(1, 6)]
        return block

    story += _team_block(_safe(home, "name", "Name", default="Local"), home)
    story += _team_block(_safe(away, "name", "Name", default="Visitante"), away)

    _build(doc, story)
    return buf.getvalue()


def build_pdf_player_stats(player_id: str, stats: dict[str, Any]) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, _ = _styles()

    rows = [["Campo", "Valor"]]
    if isinstance(stats, dict):
        for key, value in stats.items():
            rows.append([str(key), str(value)])
    else:
        rows.append(["-", "-"])

    story: list[Any] = [
        Paragraph(f"Estadisticas del Jugador #{player_id}", title),
        Spacer(1, 8),
        _table(rows, col_widths=[180, 260]),
    ]
    _build(doc, story)
    return buf.getvalue()


def build_pdf_stats_summary(
    title_text: str,
    rows: list[list[Any]],
    subtitle: Optional[str] = None,
    col_widths: Optional[list[float]] = None,
) -> list[Any]:
    _, h2, _, muted = _styles()
    elems: list[Any] = [Paragraph(title_text, h2)]
    if subtitle:
        elems.extend([Paragraph(subtitle, muted), Spacer(1, 4)])
    elems.append(_table(rows, col_widths=col_widths))
    elems.append(Spacer(1, 10))
    return elems


def build_pdf_stats_report(sections: list[tuple[str, list[list[Any]]]]) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, _ = _styles()

    story: list[Any] = [Paragraph("Resumen de Estadisticas", title), Spacer(1, 8)]
    for section_title, data in sections:
        story += build_pdf_stats_summary(
            section_title,
            data,
            col_widths=[28, 240, 60, 40, 40, 60, 60],
        )

    _build(doc, story)
    return buf.getvalue()


def build_pdf_standings(rows: list[dict[str, Any]]) -> bytes:
    buf = BytesIO()
    doc = _doc(buf)
    title, _, _, muted = _styles()

    data: list[list[Any]] = [["#", "Equipo", "Victorias"]]
    for index, entry in enumerate(rows, 1):
        data.append(
            [
                index,
                str(entry.get("name", "")),
                int(entry.get("wins", 0) or 0),
            ]
        )

    story: list[Any] = [
        Paragraph("Tabla de Posiciones", title),
        Spacer(1, 6),
        Paragraph(f"Total: {len(rows)}", muted),
        Spacer(1, 8),
        _table(data, col_widths=[28, 340, 90]),
    ]
    _build(doc, story)
    return buf.getvalue()
