import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});
  final String status;

  Color _bg(BuildContext context) {
    switch (status) {
      case 'ACTIVE':
        return const Color(0xFFECFDF5);
      case 'SUSPENDED':
        return const Color(0xFFFEF2F2);
      case 'INACTIVE':
      default:
        return const Color(0xFFF3F4F6);
    }
  }

  Color _fg(BuildContext context) {
    switch (status) {
      case 'ACTIVE':
        return const Color(0xFF047857);
      case 'SUSPENDED':
        return const Color(0xFFB91C1C);
      case 'INACTIVE':
      default:
        return const Color(0xFF4B5563);
    }
  }

  String get _label {
    final lower = status.toLowerCase().replaceAll('_', ' ');
    return lower[0].toUpperCase() + lower.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _bg(context),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _label,
        style: TextStyle(color: _fg(context), fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
