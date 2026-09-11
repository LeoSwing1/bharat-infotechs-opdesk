class DashboardSummary {
  final String scope; // "organization" | "team" | "personal" | "demo"
  final bool available;
  final int? totalPeople;
  final int? activePeople;
  final int? activeTeams;
  final int? totalTasks;
  final int? overdueTasks;
  final int? teamMembers;
  final int? myTasks;
  final int? myOverdueTasks;
  final Map<String, int> tasksByStatus;

  DashboardSummary({
    required this.scope,
    required this.available,
    this.totalPeople,
    this.activePeople,
    this.activeTeams,
    this.totalTasks,
    this.overdueTasks,
    this.teamMembers,
    this.myTasks,
    this.myOverdueTasks,
    this.tasksByStatus = const {},
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['tasksByStatus'] as Map<String, dynamic>? ?? {};
    return DashboardSummary(
      scope: json['scope'] as String? ?? 'demo',
      available: json['available'] as bool? ?? false,
      totalPeople: (json['totalPeople'] as num?)?.toInt(),
      activePeople: (json['activePeople'] as num?)?.toInt(),
      activeTeams: (json['activeTeams'] as num?)?.toInt(),
      totalTasks: (json['totalTasks'] as num?)?.toInt(),
      overdueTasks: (json['overdueTasks'] as num?)?.toInt(),
      teamMembers: (json['teamMembers'] as num?)?.toInt(),
      myTasks: (json['myTasks'] as num?)?.toInt(),
      myOverdueTasks: (json['myOverdueTasks'] as num?)?.toInt(),
      tasksByStatus: rawStatus.map((k, v) => MapEntry(k, (v as num).toInt())),
    );
  }
}
