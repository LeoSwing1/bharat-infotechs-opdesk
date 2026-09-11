class Team {
  final String id;
  final String name;
  final String code;
  final String? description;
  final bool active;
  final String? leadUserId;
  final String? leadName;
  final String? hrUserId;
  final String? hrName;
  final String? departmentName;
  final int memberCount;

  Team({
    required this.id,
    required this.name,
    required this.code,
    this.description,
    required this.active,
    this.leadUserId,
    this.leadName,
    this.hrUserId,
    this.hrName,
    this.departmentName,
    required this.memberCount,
  });

  factory Team.fromJson(Map<String, dynamic> json) => Team(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
        description: json['description'] as String?,
        active: json['active'] as bool? ?? true,
        leadUserId: json['leadUserId'] as String?,
        leadName: json['leadName'] as String?,
        hrUserId: json['hrUserId'] as String?,
        hrName: json['hrName'] as String?,
        departmentName: json['departmentName'] as String?,
        memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
      );
}

class TeamMember {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? employeeCode;
  final String? designation;
  final String status;

  TeamMember({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.employeeCode,
    this.designation,
    required this.status,
  });

  factory TeamMember.fromJson(Map<String, dynamic> json) => TeamMember(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        employeeCode: json['employeeCode'] as String?,
        designation: json['designation'] as String?,
        status: json['status'] as String,
      );
}
