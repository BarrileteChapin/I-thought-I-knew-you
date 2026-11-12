window.GameMethods = Object.assign(window.GameMethods || {}, {
  openProfMenu() { this.setState({ profMenuOpen: true }); },

  closeProfMenu() { this.setState({ profMenuOpen: false, reportReasonOpen: false }); },

  openReportReason() { this.setState({ profMenuOpen: false, reportReasonOpen: true }); },

  submitReport() {
    const handle = this.state.socProfileKey;
    if (!handle) return;
    this.setState(s => ({
      reportReasonOpen: false, reportToast: true,
      reportedAccounts: Object.assign({}, s.reportedAccounts, { [handle]: true }),
      reportedFake: s.reportedFake || handle === '@n.krueger',
      reportedWrong: s.reportedWrong || handle === '@nicole_kruger'
    }));
    this.advance(2);
    if (handle === '@nicole_kruger') this.rel(-10, 0, '');
    clearTimeout(this._rt); this._rt = setTimeout(() => this.setState({ reportToast: false }), 2200);
  },

  chooseReasonImpersonation() { this.submitReport(); },

  chooseReasonHarassment() { this.submitReport(); },

  chooseReasonOther() { this.submitReport(); },

  rel(dSam, dGroup, reason) {
    this.setState(s => ({
      sam: this.clamp(s.sam + (dSam || 0)),
      group: this.clamp(s.group + (dGroup || 0)),
      flashSam: dSam ? true : s.flashSam,
      flashGroup: dGroup ? true : s.flashGroup,
      reason: reason || ''
    }), () => {
      if (!this.state.samDead && (this.state.samSilent || this.state.sam < 16)) this.setState({ samDead: true, sam: 0 });
    });
    if (dSam) { clearTimeout(this._ts); this._ts = setTimeout(() => this.setState({ flashSam: false, reason: '' }), 2100); }
    if (dGroup) { clearTimeout(this._tg); this._tg = setTimeout(() => this.setState({ flashGroup: false, reason: '' }), 2100); }
  }
});
