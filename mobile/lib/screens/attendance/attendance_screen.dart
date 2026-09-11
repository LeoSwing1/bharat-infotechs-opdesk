import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/opdesk_repository.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  Map<String, dynamic>? today;
  List<dynamic> history = <dynamic>[];
  Timer? pollTimer;
  Timer? clockTimer;
  bool loading = true;
  bool busy = false;
  DateTime now = DateTime.now();

  @override
  void initState() {
    super.initState();
    load();
    pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => load(silent: true));
    clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => now = DateTime.now());
    });
  }

  @override
  void dispose() {
    pollTimer?.cancel();
    clockTimer?.cancel();
    super.dispose();
  }

  Future<void> load({bool silent = false}) async {
    if (!silent && mounted) setState(() => loading = true);
    try {
      final repo = context.read<OpDeskRepository>();
      final responses = await Future.wait([
        repo.getRaw('/api/attendance/today'),
        repo.getRaw('/api/attendance'),
      ]);
      if (!mounted) return;
      setState(() {
        today = responses[0];
        history = (responses[1]['records'] as List?)?.toList() ?? <dynamic>[];
        loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => loading = false);
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> action(String endpoint, String success) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await context.read<OpDeskRepository>().postRaw(endpoint, {});
      await load(silent: true);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  DateTime? _date(dynamic value) => value == null ? null : DateTime.tryParse(value.toString())?.toLocal();

  String _time(dynamic value) {
    final d = _date(value);
    return d == null ? '—' : DateFormat('hh:mm a').format(d);
  }

  String _dateLabel(dynamic value) {
    if (value == null) return '—';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    final local = parsed.toLocal();
    final todayDate = DateTime(now.year, now.month, now.day);
    final date = DateTime(local.year, local.month, local.day);
    if (date == todayDate) return 'Today';
    if (date == todayDate.subtract(const Duration(days: 1))) return 'Yesterday';
    return DateFormat('EEE, dd MMM').format(local);
  }

  String _duration(int? minutes) {
    if (minutes == null) return '—';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
  }

  int _liveWorked() => (today?['liveWorkedMinutes'] as num?)?.toInt() ?? 0;
  int _liveBreak() => (today?['liveBreakMinutes'] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    final status = (today?['row']?['status'] ?? 'NOT_STARTED').toString();
    final clockedIn = today?['clockedIn'] == true;
    final onBreak = today?['onBreak'] == true;
    final clockOut = today?['row']?['clockOutAt'] != null;
    final available = today?['available'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [IconButton(onPressed: () => load(), icon: const Icon(Icons.refresh_rounded))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 30),
                children: [
                  _LiveCard(
                    status: status,
                    worked: _liveWorked(),
                    breakMinutes: _liveBreak(),
                    clockedIn: clockedIn,
                    onBreak: onBreak,
                    clockedOut: clockOut,
                    available: available,
                    now: now,
                  ),
                  const SizedBox(height: 14),
                  if (!available)
                    const _NoticeCard(
                      icon: Icons.cloud_off_rounded,
                      title: 'Attendance is not connected',
                      text: 'Connect PostgreSQL and disable demo mode to use live attendance.',
                    )
                  else if (!clockedIn)
                    _ActionButton(
                      label: 'Clock In',
                      icon: Icons.login_rounded,
                      filled: true,
                      busy: busy,
                      onTap: () => action('/api/attendance/clock-in', 'Clocked in successfully'),
                    )
                  else if (!clockOut) ...[
                    _ActionButton(
                      label: onBreak ? 'End Break' : 'Start Break',
                      icon: onBreak ? Icons.play_arrow_rounded : Icons.coffee_rounded,
                      filled: false,
                      busy: busy,
                      onTap: () => action(
                        onBreak ? '/api/attendance/break-end' : '/api/attendance/break-start',
                        onBreak ? 'Break ended' : 'Break started',
                      ),
                    ),
                    const SizedBox(height: 10),
                    _ActionButton(
                      label: 'Clock Out',
                      icon: Icons.logout_rounded,
                      filled: true,
                      busy: busy,
                      onTap: () => action('/api/attendance/clock-out', 'Clocked out successfully'),
                    ),
                  ] else
                    const _NoticeCard(
                      icon: Icons.check_circle_outline_rounded,
                      title: 'Workday complete',
                      text: 'Your attendance for today has been closed.',
                    ),
                  const SizedBox(height: 22),
                  const Text('Today\'s timeline', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  _Timeline(today: today),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Attendance history', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      Text('${history.length} records', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (history.isEmpty)
                    const _NoticeCard(icon: Icons.history_rounded, title: 'No history yet', text: 'Your previous attendance days will appear here.')
                  else
                    ...history.take(14).map((raw) {
                      final r = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
                      final worked = (r['workedMinutes'] as num?)?.toInt();
                      final breakMinutes = (r['breakMinutes'] as num?)?.toInt() ?? 0;
                      return Card(
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.grey.shade200)),
                        child: Padding(
                          padding: const EdgeInsets.all(15),
                          child: Column(
                            children: [
                              Row(children: [
                                Expanded(child: Text(_dateLabel(r['attendanceDate']), style: const TextStyle(fontWeight: FontWeight.w800))),
                                _StatusPill(text: (r['status'] ?? 'UNKNOWN').toString()),
                              ]),
                              const SizedBox(height: 12),
                              Row(children: [
                                Expanded(child: _Metric('In', _time(r['clockInAt']))),
                                Expanded(child: _Metric('Out', _time(r['clockOutAt']))),
                                Expanded(child: _Metric('Worked', _duration(worked))),
                                Expanded(child: _Metric('Break', _duration(breakMinutes))),
                              ]),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _LiveCard extends StatelessWidget {
  const _LiveCard({required this.status, required this.worked, required this.breakMinutes, required this.clockedIn, required this.onBreak, required this.clockedOut, required this.available, required this.now});
  final String status;
  final int worked;
  final int breakMinutes;
  final bool clockedIn;
  final bool onBreak;
  final bool clockedOut;
  final bool available;
  final DateTime now;

  String duration(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final accent = onBreak ? Colors.orange.shade700 : Theme.of(context).colorScheme.primary;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(DateFormat('EEEE, dd MMMM').format(now), style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              const SizedBox(height: 4),
              Text(DateFormat('hh:mm:ss a').format(now), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ]),
            _StatusPill(text: status),
          ]),
          const SizedBox(height: 22),
          Icon(onBreak ? Icons.coffee_rounded : clockedIn ? Icons.work_history_rounded : Icons.access_time_rounded, size: 54, color: accent),
          const SizedBox(height: 8),
          Text(available && clockedIn && !clockedOut ? duration(worked) : '00:00', style: const TextStyle(fontSize: 38, fontWeight: FontWeight.w900, letterSpacing: 1)),
          Text(onBreak ? 'Break in progress' : clockedIn ? 'Worked today' : 'Not started', style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(child: _Metric('Break', duration(breakMinutes))),
            Expanded(child: _Metric('State', clockedOut ? 'Closed' : onBreak ? 'Break' : clockedIn ? 'Working' : 'Ready')),
          ]),
        ]),
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.today});
  final Map<String, dynamic>? today;

  String time(dynamic v) {
    if (v == null) return '—';
    final d = DateTime.tryParse(v.toString())?.toLocal();
    return d == null ? '—' : DateFormat('hh:mm a').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final events = (today?['events'] as List?)?.toList() ?? <dynamic>[];
    final labels = <String, String>{'CLOCK_IN': 'Clock in', 'BREAK_START': 'Break started', 'BREAK_END': 'Break ended', 'CLOCK_OUT': 'Clock out'};
    if (events.isEmpty) return const _NoticeCard(icon: Icons.timeline_rounded, title: 'Nothing recorded yet', text: 'Your clock-in and break events will appear here.');
    return Card(elevation: 0, child: Column(children: [
      ...events.map((raw) {
        final e = raw is Map ? raw : <String, dynamic>{};
        final type = e['type']?.toString() ?? 'EVENT';
        return ListTile(
          leading: CircleAvatar(radius: 17, child: Icon(type == 'CLOCK_IN' ? Icons.login_rounded : type == 'CLOCK_OUT' ? Icons.logout_rounded : Icons.coffee_rounded, size: 17)),
          title: Text(labels[type] ?? type, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: e['note'] == null ? null : Text(e['note'].toString()),
          trailing: Text(time(e['occurredAt']), style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
        );
      }),
    ]));
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 11)), const SizedBox(height: 3), Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))]);
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6), decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: .08), borderRadius: BorderRadius.circular(30)), child: Text(text.replaceAll('_', ' '), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary)));
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.label, required this.icon, required this.filled, required this.busy, required this.onTap});
  final String label;
  final IconData icon;
  final bool filled;
  final bool busy;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => SizedBox(width: double.infinity, height: 54, child: filled ? FilledButton.icon(onPressed: busy ? null : onTap, icon: busy ? const SizedBox(width: 19, height: 19, child: CircularProgressIndicator(strokeWidth: 2)) : Icon(icon), label: Text(label, style: const TextStyle(fontWeight: FontWeight.w800))) : OutlinedButton.icon(onPressed: busy ? null : onTap, icon: Icon(icon), label: Text(label, style: const TextStyle(fontWeight: FontWeight.w800))));
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.icon, required this.title, required this.text});
  final IconData icon;
  final String title;
  final String text;
  @override
  Widget build(BuildContext context) => Card(elevation: 0, child: Padding(padding: const EdgeInsets.all(18), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, size: 28), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 4), Text(text, style: TextStyle(color: Colors.grey.shade600, height: 1.4))]))])));
}
