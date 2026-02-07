export class LocalDropModule {
    constructor() {
        this.socket = io();
        this.myId = null;
        this.peers = new Map(); // id -> RTCPeerConnection
        this.dataChannels = new Map(); // id -> RTCDataChannel
        this.devicesGrid = document.getElementById('devicesGrid');
        this.fileInput = document.getElementById('localdropFileInput');
        this.modal = document.getElementById('transferModal');
        this.targetPeerId = null;

        this.initSocket();
        this.initEvents();
    }

    initShare(serverIp) {
        let hostname = window.location.hostname;
        const port = window.location.port;

        // If we are on localhost, use the real server IP for the share URL
        if ((hostname === 'localhost' || hostname === '127.0.0.1') && serverIp) {
            hostname = serverIp;
        }

        // Construct URL with #localdrop to trigger the auto-switch on target device
        const shareUrl = `http://${hostname}${port ? ':' + port : ''}/#localdrop`;

        const urlDisplay = document.getElementById('localUrlDisplay');
        if (urlDisplay) urlDisplay.textContent = shareUrl;

        const copyBtn = document.getElementById('copyUrlBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(shareUrl);
                const originalContent = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i data-lucide="check"></i>';
                if (window.lucide) window.lucide.createIcons();
                setTimeout(() => {
                    copyBtn.innerHTML = originalContent;
                    if (window.lucide) window.lucide.createIcons();
                }, 2000);
            });
        }

        // Generate QR Code
        const qrcodeContainer = document.getElementById('qrcode');
        if (qrcodeContainer && window.QRCode) {
            qrcodeContainer.innerHTML = ''; // Clear previous if any
            new QRCode(qrcodeContainer, {
                text: shareUrl,
                width: 120,
                height: 120,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    initSocket() {
        this.socket.on('init', (data) => {
            this.myId = data.id;
            const myName = document.getElementById('myName');
            const myAvatar = document.getElementById('myAvatar');
            if (myName) myName.textContent = data.name;
            if (myAvatar) {
                myAvatar.textContent = data.name.charAt(0);
                myAvatar.style.background = this.getAvatarColor(data.name);
            }

            // Once we have initials from server, initialize share with the real IP
            this.initShare(data.serverIp);
        });

        this.socket.on('clients-list', (clients) => {
            clients.forEach(client => this.addDeviceCard(client));
        });

        this.socket.on('client-connected', (client) => {
            this.addDeviceCard(client);
        });

        this.socket.on('client-disconnected', (id) => {
            this.removeDeviceCard(id);
            if (this.peers.has(id)) {
                this.peers.get(id).close();
                this.peers.delete(id);
            }
            this.dataChannels.delete(id);
        });

        this.socket.on('signal', async ({ from, signal }) => {
            if (!this.peers.has(from)) {
                this.createPeerConnection(from, false);
            }
            const pc = this.peers.get(from);

            try {
                if (signal.type === 'offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    this.socket.emit('signal', { to: from, from: this.myId, signal: answer });
                } else if (signal.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                } else if (signal.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal));
                }
            } catch (e) {
                console.error('Signal error:', e);
            }
        });
    }

    initEvents() {
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && this.targetPeerId) {
                this.sendFile(this.targetPeerId, file);
            }
        });
    }

    getAvatarColor(name) {
        const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    addDeviceCard(client) {
        // Remove "no devices" if it exists
        const noDevices = this.devicesGrid.querySelector('.no-devices');
        if (noDevices) noDevices.remove();

        if (document.getElementById(`device-${client.id}`)) return;

        const card = document.createElement('div');
        card.id = `device-${client.id}`;
        card.className = 'device-card';
        card.innerHTML = `
            <div class="device-avatar" style="background: ${this.getAvatarColor(client.name)}">${client.name.charAt(0)}</div>
            <div class="device-name">${client.name}</div>
        `;

        card.addEventListener('click', () => {
            this.targetPeerId = client.id;
            this.fileInput.click();
        });

        this.devicesGrid.appendChild(card);
    }

    removeDeviceCard(id) {
        const card = document.getElementById(`device-${id}`);
        if (card) card.remove();

        if (this.devicesGrid.children.length === 0) {
            this.devicesGrid.innerHTML = `
                <div class="no-devices">
                    <div class="no-devices-icon"><i data-lucide="radar"></i></div>
                    <p>Recherche d'autres appareils sur le réseau...</p>
                    <p class="subtext">Ouvrez Ultra Dashboard sur un autre appareil pour le voir ici.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    createPeerConnection(peerId, isInitiator) {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peers.set(peerId, pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('signal', { to: peerId, from: this.myId, signal: event.candidate });
            }
        };

        if (isInitiator) {
            const dc = pc.createDataChannel('fileTransfer');
            this.setupDataChannel(peerId, dc);

            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                this.socket.emit('signal', { to: peerId, from: this.myId, signal: offer });
            });
        } else {
            pc.ondatachannel = (event) => {
                this.setupDataChannel(peerId, event.channel);
            };
        }

        return pc;
    }

    setupDataChannel(peerId, dc) {
        this.dataChannels.set(peerId, dc);

        let receivedChunks = [];
        let metadata = null;

        dc.onopen = () => console.log(`Data Channel open with ${peerId}`);
        dc.onclose = () => console.log(`Data Channel closed with ${peerId}`);

        dc.onmessage = (event) => {
            const data = event.data;

            if (typeof data === 'string') {
                const msg = JSON.parse(data);
                if (msg.type === 'metadata') {
                    metadata = msg.data;
                    receivedChunks = [];
                    this.showTransferModal(metadata.name, 'Réception...');
                }
            } else {
                receivedChunks.push(data);
                const progress = Math.round((receivedChunks.length * 16384 / metadata.size) * 100);
                this.updateProgress(progress);

                if (receivedChunks.length * 16384 >= metadata.size) {
                    const blob = new Blob(receivedChunks);
                    const url = URL.createObjectURL(blob);

                    this.updateProgress(100);
                    const statusEl = document.getElementById('transferStatus');
                    statusEl.innerHTML = `Transfert terminé ! <br><a href="${url}" download="${metadata.name}" class="btn-primary btn-sm" style="display:inline-block; margin-top:10px; text-decoration:none; padding: 5px 10px; background: var(--primary); color: white; border-radius: 4px;">Télécharger ${metadata.name}</a>`;

                    const btn = statusEl.querySelector('a');
                    btn.onclick = () => {
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            this.hideTransferModal();
                            statusEl.textContent = 'Prêt';
                        }, 1000);
                    };
                }
            }
        };
    }

    async sendFile(peerId, file) {
        if (!this.peers.has(peerId)) {
            this.createPeerConnection(peerId, true);
            // Wait for data channel to open
            const checkOpen = setInterval(() => {
                const dc = this.dataChannels.get(peerId);
                if (dc && dc.readyState === 'open') {
                    clearInterval(checkOpen);
                    this._performSend(peerId, file);
                }
            }, 100);
        } else {
            const dc = this.dataChannels.get(peerId);
            if (dc.readyState === 'open') {
                this._performSend(peerId, file);
            } else {
                this._performSend(peerId, file); // Maybe it works now
            }
        }
    }

    _performSend(peerId, file) {
        const dc = this.dataChannels.get(peerId);
        if (!dc) return;

        this.showTransferModal(file.name, `Envoi vers ${peerId}...`);

        // Step 1: Send Metadata
        dc.send(JSON.stringify({
            type: 'metadata',
            data: {
                name: file.name,
                size: file.size,
                type: file.type
            }
        }));

        // Step 2: Send Chunks
        const chunkSize = 16384; // 16KB
        const reader = new FileReader();
        let offset = 0;

        reader.onload = (e) => {
            dc.send(e.target.result);
            offset += e.target.result.byteLength;
            const progress = Math.round((offset / file.size) * 100);
            this.updateProgress(progress);

            if (offset < file.size) {
                readNext();
            } else {
                setTimeout(() => this.hideTransferModal(), 1000);
            }
        };

        const readNext = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

        readNext();
    }

    showTransferModal(filename, status) {
        this.modal.classList.remove('hidden');
        document.getElementById('transferFileName').textContent = filename;
        document.getElementById('transferStatus').textContent = status;
        this.updateProgress(0);
    }

    updateProgress(percent) {
        percent = Math.min(percent, 100);
        document.getElementById('transferPercent').textContent = `${percent}%`;
        document.getElementById('transferProgressFill').style.width = `${percent}%`;
    }

    hideTransferModal() {
        this.modal.classList.add('hidden');
    }
}
