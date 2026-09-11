import '../core/api_client.dart';
import '../models/session_user.dart';
import '../models/person.dart';
import '../models/team.dart';
import '../models/dashboard_summary.dart';

class OpDeskRepository {
  Future<Map<String, dynamic>> getRaw(String path, {Map<String, dynamic>? query}) => _api.get(path, query: query);

  Future<Map<String, dynamic>> postRaw(String path, Map<String, dynamic> body) => _api.post(path, body);
  Future<Map<String, dynamic>> patchRaw(String path, Map<String, dynamic> body) => _api.patch(path, body);

  OpDeskRepository(this._api);
  final ApiClient _api;

  // ---------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------

  /// [identifier] can be either the person's email or their permanent
  /// employee ID (e.g. "BI-EMP-26-00001") — the backend accepts both.
  Future<SessionUser> login(String identifier, String password) async {
    final res = await _api.post('/api/auth/login', {'identifier': identifier, 'password': password});
    final token = res['token'] as String?;
    if (token != null) await _api.saveToken(token);
    return SessionUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  Future<SessionUser?> currentUser() async {
    if (!await _api.hasToken()) return null;
    try {
      final res = await _api.get('/api/auth/me');
      final user = res['user'];
      if (user == null) return null;
      return SessionUser.fromJson(user as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (e.statusCode == 401) return null;
      rethrow;
    }
  }

  Future<void> logout() async {
    await _api.clearToken();
  }

  // ---------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------

  Future<DashboardSummary> dashboardSummary() async {
    final res = await _api.get('/api/dashboard/summary');
    return DashboardSummary.fromJson(res);
  }

  // ---------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------

  Future<List<Person>> listPeople({String? search, String? teamId}) async {
    final res = await _api.get('/api/people', query: {
      if (search != null && search.isNotEmpty) 'search': search,
      if (teamId != null) 'teamId': teamId,
    });
    final list = (res['people'] as List?) ?? [];
    return list.map((e) => Person.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Person> getPerson(String id) async {
    final res = await _api.get('/api/people/$id');
    return Person.fromJson(res['person'] as Map<String, dynamic>);
  }

  /// Returns the created person plus, if the server generated one, a
  /// one-time temporary password that must be shown to the admin now —
  /// it is never retrievable again after this call.
  /// [email] is optional — if omitted, the backend auto-generates one
  /// following the Bharat Infotechs convention (interns get
  /// @internsbharatinfotechs.com, everyone else @bharatinfotechs.com).
  Future<(Person, String?)> createPerson({
    required String name,
    String? email,
    String? phone,
    required String role,
    String employmentType = 'EMPLOYEE',
    String? designation,
    String? departmentId,
    String? teamId,
  }) async {
    final res = await _api.post('/api/people', {
      'name': name,
      if (email != null && email.isNotEmpty) 'email': email,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'role': role,
      'employmentType': employmentType,
      if (designation != null && designation.isNotEmpty) 'designation': designation,
      if (departmentId != null) 'departmentId': departmentId,
      if (teamId != null) 'teamId': teamId,
    });
    final person = Person.fromJson(res['person'] as Map<String, dynamic>);
    return (person, res['temporaryPassword'] as String?);
  }

  Future<Person> setPersonStatus(String id, String status) async {
    final res = await _api.patch('/api/people/$id', {'status': status});
    return Person.fromJson(res['person'] as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------

  Future<List<Team>> listTeams() async {
    final res = await _api.get('/api/teams');
    final list = (res['teams'] as List?) ?? [];
    return list.map((e) => Team.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<(Team, List<TeamMember>)> getTeam(String id) async {
    final res = await _api.get('/api/teams/$id');
    final team = Team.fromJson(res['team'] as Map<String, dynamic>);
    final members = ((res['members'] as List?) ?? [])
        .map((e) => TeamMember.fromJson(e as Map<String, dynamic>))
        .toList();
    return (team, members);
  }

  Future<Team> createTeam({
    required String name,
    required String code,
    String? description,
    String? departmentId,
    String? leadUserId,
    String? hrUserId,
  }) async {
    final res = await _api.post('/api/teams', {
      'name': name,
      'code': code,
      if (description != null && description.isNotEmpty) 'description': description,
      if (departmentId != null) 'departmentId': departmentId,
      if (leadUserId != null) 'leadUserId': leadUserId,
      if (hrUserId != null) 'hrUserId': hrUserId,
    });
    return Team.fromJson(res['team'] as Map<String, dynamic>);
  }

  Future<void> addTeamMember(String teamId, String userId) =>
      _api.post('/api/teams/$teamId/members', {'userId': userId});

  Future<void> removeTeamMember(String teamId, String userId) =>
      _api.delete('/api/teams/$teamId/members', query: {'userId': userId});

  // ---------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------

  Future<List<(String id, String name)>> listDepartments() async {
    final res = await _api.get('/api/departments');
    final list = (res['departments'] as List?) ?? [];
    return list
        .map((e) => (e['id'] as String, e['name'] as String))
        .toList();
  }

  // ---------------------------------------------------------------------
  // Roles & Permissions (Super Admin)
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>> permissionMatrix() => _api.get('/api/settings/permissions');

  Future<void> setRolePermission({
    required String role,
    required String permissionKey,
    required bool granted,
  }) =>
      _api.patch('/api/settings/permissions', {
        'role': role,
        'permissionKey': permissionKey,
        'granted': granted,
      });
}

extension OpDeskWorkflow on OpDeskRepository {

  Future<Map<String, dynamic>> attendanceToday() => getRaw('/api/attendance/today');
  Future<List<dynamic>> attendanceHistory() async {
    final res = await getRaw('/api/attendance');
    return (res['records'] as List?)?.toList() ?? <dynamic>[];
  }

  Future<Map<String, dynamic>> getTask(String id) => getRaw('/api/tasks/$id');
  Future<Map<String, dynamic>> transitionTask(String id, String action, {String? comment}) =>
      patchRaw('/api/tasks/$id', {'action': action, if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim()});
  Future<Map<String, dynamic>> listConversations() => getRaw('/api/chat/conversations');
  Future<Map<String, dynamic>> listMessages(String conversationId) => getRaw('/api/chat/conversations/$conversationId/messages');
  Future<Map<String, dynamic>> sendMessage(String conversationId, String body) =>
      postRaw('/api/chat/conversations/$conversationId/messages', {'type': 'TEXT', 'body': body});

  Future<Map<String, dynamic>> createConversation({required String type, required List<String> memberIds, String? name}) =>
      postRaw('/api/chat/conversations', {'type': type, 'memberIds': memberIds, if (name != null && name.trim().isNotEmpty) 'name': name.trim()});

  Future<void> markConversationRead(String conversationId) async {
    await _api.patch('/api/chat/conversations/$conversationId/messages', {});
  }
}
