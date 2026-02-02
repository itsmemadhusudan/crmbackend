const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.Mixed, required: true },
    action: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changes: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
