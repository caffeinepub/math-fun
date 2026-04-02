import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";



actor {
  type Badge = {
    name : Text;
    description : Text;
  };

  type PlayerStats = {
    score : Nat;
    totalXp : Nat;
    level : Nat;
    streak : Nat;
    highScore : Nat;
    badges : [Badge];
  };

  let players = Map.empty<Principal, PlayerStats>();
  let leaderboard = List.empty<(Principal, Nat)>();

  func updateLeaderboard(principal : Principal, score : Nat) {
    let entries = leaderboard.values().toArray();

    let filteredEntries = entries.filter(
      func(entry) { entry.0 != principal }
    );

    let newEntries = filteredEntries.concat([(principal, score)]);

    let sortedEntries = newEntries.sort(
      func(a, b) { Nat.compare(b.1, a.1) }
    );

    let topTen = sortedEntries.sliceToArray(0, Nat.min(10, sortedEntries.size()));

    let finalEntries = topTen.map(
      func((p, s)) { (p, s) }
    );

    leaderboard.clear();
    leaderboard.addAll(finalEntries.values());
  };

  func computeLevel(xp : Nat) : Nat {
    xp / 100;
  };

  func getUpdatedBadges(existingBadges : [Badge], newBadges : [Badge]) : [Badge] {
    let combined = existingBadges.concat(newBadges);

    let uniqueBadges = List.empty<Badge>();
    for (badge in combined.values()) {
      if (not uniqueBadges.find(func(b) { b.name == badge.name }).isSome()) {
        uniqueBadges.add(badge);
      };
    };
    uniqueBadges.toArray();
  };

  public shared ({ caller }) func updateStats(score : Nat, xp : Nat, streak : Nat, badges : [Badge]) : async () {
    let existingStats = switch (players.get(caller)) {
      case (?stat) {
        {
          score;
          totalXp = stat.totalXp + xp;
          level = computeLevel(stat.totalXp + xp);
          streak;
          highScore = Nat.max(stat.highScore, score);
          badges = getUpdatedBadges(stat.badges, badges);
        };
      };
      case (null) {
        {
          score;
          totalXp = xp;
          level = computeLevel(xp);
          streak;
          highScore = score;
          badges = getUpdatedBadges([], badges);
        };
      };
    };

    players.add(caller, existingStats);

    if (score > 0) {
      updateLeaderboard(caller, score);
    };
  };

  public query ({ caller }) func getStats() : async PlayerStats {
    switch (players.get(caller)) {
      case (?stats) { stats };
      case (null) { Runtime.trap("Player not found") : PlayerStats };
    };
  };

  public query ({ caller }) func getLeaderboard() : async [(Principal, Nat)] {
    leaderboard.toArray();
  };

  public query ({ caller }) func whoami() : async Principal {
    caller;
  };
};
