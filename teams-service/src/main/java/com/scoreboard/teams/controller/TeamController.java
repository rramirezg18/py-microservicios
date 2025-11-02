package com.scoreboard.teams.controller;

import com.scoreboard.teams.dto.PlayerDto;
import com.scoreboard.teams.model.Team;
import com.scoreboard.teams.service.TeamService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
@CrossOrigin("*")
public class TeamController {

    private final TeamService service;

    public TeamController(TeamService service) {
        this.service = service;
    }

 
    @GetMapping
    public Page<Team> getAll(
        @RequestParam(name = "page",  defaultValue = "0")  int page,
        @RequestParam(name = "size",  defaultValue = "10") int size,
        @RequestParam(name = "search", required = false)   String search
    ) {
        return service.findAll(search, page, size);
    }


    @GetMapping("/{id}")
    public Team getById(@PathVariable Long id) {
        return service.findById(id);
    }


    @PostMapping
    public ResponseEntity<Team> create(@RequestBody @Valid Team team) {
        Team created = service.save(team);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }


    @PutMapping("/{id}")
    public Team update(@PathVariable Long id, @RequestBody @Valid Team team) {
        team.setId(id);
        return service.save(team);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }


    @GetMapping("/{id}/players")
    public List<PlayerDto> getPlayersById(@PathVariable Long id) {
        return service.getPlayersByTeam(id);
    }


    @GetMapping("/name/{teamName}/players")
    public List<PlayerDto> getPlayersByName(@PathVariable String teamName) {
        return service.getPlayersByTeamName(teamName);
    }
}
