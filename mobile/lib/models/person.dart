class Person {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final String status;
  final String? employeeCode;
  final String? employmentType;
  final String? designation;
  final String? teamId;
  final String? teamName;
  final String? departmentId;
  final String? departmentName;
  final String? joiningDate;

  Person({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    required this.status,
    this.employeeCode,
    this.employmentType,
    this.designation,
    this.teamId,
    this.teamName,
    this.departmentId,
    this.departmentName,
    this.joiningDate,
  });

  factory Person.fromJson(Map<String, dynamic> json) => Person(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        phone: json['phone'] as String?,
        role: json['role'] as String,
        status: json['status'] as String,
        employeeCode: json['employeeCode'] as String?,
        employmentType: json['employmentType'] as String?,
        designation: json['designation'] as String?,
        teamId: json['teamId'] as String?,
        teamName: json['teamName'] as String?,
        departmentId: json['departmentId'] as String?,
        departmentName: json['departmentName'] as String?,
        joiningDate: json['joiningDate'] as String?,
      );
}
