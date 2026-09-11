class SessionUser {
  final String id;
  final String organizationId;
  final String name;
  final String email;
  final String role;

  SessionUser({
    required this.id,
    required this.organizationId,
    required this.name,
    required this.email,
    required this.role,
  });

  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
        id: json['id'] as String,
        organizationId: json['organizationId'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
      );

  bool get isSuperAdmin => role == 'SUPER_ADMIN';
  bool get isHrManager => role == 'HR_MANAGER';
  bool get isManager => role == 'MANAGER';
  bool get isTeamLead => role == 'TEAM_LEAD';

  /// Roles that can create people / teams by default, per OPDesk's
  /// permission catalog defaults. This is only used for optimistic UI —
  /// the server is the source of truth and re-checks on every write.
  bool get canManagePeopleByDefault => isSuperAdmin || isHrManager;
}
