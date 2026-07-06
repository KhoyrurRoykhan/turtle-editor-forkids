import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { Button, Modal, Form, Navbar, Nav, Container } from 'react-bootstrap';
import { BsArrowClockwise, BsPlayFill, BsFolder2Open, BsDownload, BsSave2, BsMoon, BsSun } from 'react-icons/bs';
import { FaCode } from 'react-icons/fa';

const App = () => {
    const [pythonCode, setPythonCode] = useState('');
    const [output, setOutput] = useState('');
    const [filename, setFilename] = useState('my_code');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [theme, setTheme] = useState('light');
    const [isRunning, setIsRunning] = useState(false);
    const fileInputRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const outf = (text) => {
        setOutput((prev) => prev + text);
    };

    const builtinRead = (x) => {
        if (window.Sk.builtinFiles === undefined || window.Sk.builtinFiles['files'][x] === undefined) {
            throw `File not found: '${x}'`;
        }
        return window.Sk.builtinFiles['files'][x];
    };

    const parseSimpleCommands = (code) => {
        const lines = code.split('\n');
        const parsedLines = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();
            const leadingSpaces = line.match(/^\s*/)?.[0] || '';
            if (trimmed === '' || trimmed.startsWith('#')) {
                parsedLines.push(line);
                i++;
                continue;
            }
            const forMatch = trimmed.match(/^for\s+(\d+)$/);
            if (forMatch) {
                const loopCount = parseInt(forMatch[1]);
                parsedLines.push(`${leadingSpaces}for i in range(${loopCount}):`);
                i++;
                while (i < lines.length) {
                    const nextLine = lines[i];
                    const nextTrimmed = nextLine.trim();
                    const nextIndent = nextLine.match(/^\s*/)?.[0].length || 0;
                    if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
                        parsedLines.push(nextLine);
                        i++;
                        continue;
                    }
                    if (nextIndent <= leadingSpaces.length) break;
                    const parts = nextTrimmed.split(/\s+/);
                    const cmd = parts[0];
                    const args = parts.slice(1);
                    const isAllArgsNumeric = args.every(arg => !isNaN(parseFloat(arg)));
                    const isStringArg = args.length === 1 && /^["'].*["']$/.test(args[0]);
                    const isMixedNumericStringArgs = args.length === 2 && !isNaN(parseFloat(args[0])) && /^["'].*["']$/.test(args[1]);
                    if (nextTrimmed.includes('(') && nextTrimmed.includes(')')) {
                        parsedLines.push(nextLine);
                    } else if ((isAllArgsNumeric && args.length > 0) || isStringArg || isMixedNumericStringArgs) {
                        parsedLines.push(`${nextLine.match(/^\s*/)?.[0] || ''}${cmd}(${args.join(',')})`);
                    } else {
                        parsedLines.push(nextLine);
                    }
                    i++;
                }
                continue;
            }
            const parts = trimmed.split(/\s+/);
            const cmd = parts[0];
            const args = parts.slice(1);
            const noArgCommands = ['clear', 'home', 'reset', 'penup', 'pendown', 'showturtle', 'hideturtle', 'begin_fill', 'end_fill'];
            const isAllArgsNumeric = args.every(arg => !isNaN(parseFloat(arg)));
            const isStringArg = args.length === 1 && /^["'].*["']$/.test(args[0]);
            const isMixedNumericStringArgs = args.length === 2 && !isNaN(parseFloat(args[0])) && /^["'].*["']$/.test(args[1]);
            if (cmd === 'print' && args.length >= 1) {
                const arg = args[0];
                if (arg === 'position') {
                    parsedLines.push(`${leadingSpaces}print(position())`);
                    i++;
                    continue;
                } else if (arg === 'xcor') {
                    parsedLines.push(`${leadingSpaces}print(xcor())`);
                    i++;
                    continue;
                } else if (arg === 'ycor') {
                    parsedLines.push(`${leadingSpaces}print(ycor())`);
                    i++;
                    continue;
                } else if (arg === 'heading') {
                    parsedLines.push(`${leadingSpaces}print(heading())`);
                    i++;
                    continue;
                } else if (arg === 'isdown') {
                    parsedLines.push(`${leadingSpaces}print(isdown())`);
                    i++;
                    continue;
                } else if (arg === 'distance') {
                    if (args.length === 3 && !isNaN(args[1]) && !isNaN(args[2])) {
                        parsedLines.push(`${leadingSpaces}print(distance(${args[1]},${args[2]}))`);
                        i++;
                        continue;
                    }
                }
            }
            if (trimmed.includes('(') && trimmed.includes(')')) {
                parsedLines.push(line);
            } else if (noArgCommands.includes(cmd) && args.length === 0) {
                parsedLines.push(`${leadingSpaces}${cmd}()`);
            } else if ((isAllArgsNumeric && args.length > 0) || isStringArg || isMixedNumericStringArgs) {
                parsedLines.push(`${leadingSpaces}${cmd}(${args.join(',')})`);
            } else {
                parsedLines.push(line);
            }
            i++;
        }
        return parsedLines.join('\n');
    };

    const runit = (code, forceReset = false) => {
        setIsRunning(true);
        setOutput('');
        const imports = "from turtle import *\nreset()\nshape('turtle')\nspeed(2)\n";
        const parsedCode = parseSimpleCommands(pythonCode);
        const prog = forceReset ? imports : imports + parsedCode;

        window.Sk.pre = "output";
        window.Sk.configure({ output: outf, read: builtinRead });
        (window.Sk.TurtleGraphics || (window.Sk.TurtleGraphics = {})).target = 'mycanvas';

        window.Sk.misceval.asyncToPromise(() =>
            window.Sk.importMainWithBody('<stdin>', false, prog, true)
        ).then(
            () => {
                console.log('success');
                setIsRunning(false);
            },
            (err) => {
                setOutput((prev) => prev + err.toString());
                setIsRunning(false);
            }
        );
    };

    const resetCode = () => {
        setPythonCode('');
        setOutput('');
        runit('', true);
    };

    useEffect(() => {
        runit('', true);
    }, []);

    const handleOpenFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            setPythonCode(e.target.result);
            setFilename(file.name.replace('.py', ''));
        };
        reader.readAsText(file);
    };

    const handleSaveFile = () => {
        const blob = new Blob([pythonCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeFilename = filename.trim() !== '' ? filename.trim() : 'my_code';
        const finalFilename = safeFilename.endsWith('.py') ? safeFilename : `${safeFilename}.py`;
        link.download = finalFilename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const themeStyles = {
        light: {
            background: '#f8f9fa',
            surface: '#ffffff',
            text: '#212529',
            border: '#dee2e6',
            outputBg: '#f1f3f5',
            outputText: '#212529',
            canvasBorder: '#dee2e6'
        },
        dark: {
            background: '#1e1e2f',
            surface: '#2d2d3f',
            text: '#e9ecef',
            border: '#444c5c',
            outputBg: '#0f0f1a',
            outputText: '#e0e0e0',
            canvasBorder: '#444c5c'
        }
    };

    const currentTheme = theme === 'light' ? themeStyles.light : themeStyles.dark;

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: currentTheme.background,
            transition: 'all 0.3s ease'
        }}>
            <Navbar expand="lg" style={{
                backgroundColor: '#1e5631',
                borderBottom: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <Container fluid>
                    <Navbar.Brand href="#" style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.5rem' }}>
                        <FaCode />  bidGeometry
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" style={{ backgroundColor: '#ffffff33', border: 'none' }} />
                    <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
                        <Nav>
                            <Button
                                variant="light"
                                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    backgroundColor: '#ffffff',
                                    color: '#1e5631',
                                    border: 'none',
                                    fontWeight: '500'
                                }}
                            >
                                {theme === 'light' ? <BsMoon /> : <BsSun />}
                                {theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
                            </Button>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            <Container fluid style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 440px',
                    gap: '1.5rem',
                    alignItems: 'start'
                }}>
                    <div style={{
                        background: currentTheme.surface,
                        borderRadius: '20px',
                        padding: '1.25rem',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
                        border: `1px solid ${currentTheme.border}`
                    }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <CodeMirror
                                placeholder="# Tulis kode Python turtle di sini..."
                                value={pythonCode}
                                height="400px"
                                theme={theme === 'dark' ? dracula : 'light'}
                                extensions={[python()]}
                                onChange={(value) => setPythonCode(value)}
                                style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: `1px solid ${currentTheme.border}`
                                }}
                            />
                        </div>

                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            marginBottom: '1.5rem'
                        }}>
                            <ActionButton
                                onClick={() => runit()}
                                icon={<BsPlayFill />}
                                label="Jalankan"
                                variant="primary"
                                disabled={isRunning}
                            />
                            <ActionButton
                                onClick={resetCode}
                                icon={<BsArrowClockwise />}
                                label="Reset"
                                variant="secondary"
                            />
                            <ActionButton
                                onClick={() => fileInputRef.current.click()}
                                icon={<BsFolder2Open />}
                                label="Buka File"
                                variant="outline"
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".py"
                                style={{ display: 'none' }}
                                onChange={handleOpenFile}
                            />
                            <ActionButton
                                onClick={() => setShowSaveModal(true)}
                                icon={<BsSave2 />}
                                label="Simpan File"
                                variant="outline"
                            />
                        </div>

                        <div>
                            <div style={{
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                marginBottom: '0.5rem',
                                color: currentTheme.text,
                                letterSpacing: '0.5px'
                            }}>
                                Output:
                            </div>
                            <pre style={{
                                background: currentTheme.outputBg,
                                color: currentTheme.outputText,
                                padding: '0.75rem',
                                borderRadius: '12px',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                minHeight: '80px',
                                maxHeight: '150px',
                                overflow: 'auto',
                                border: `1px solid ${currentTheme.border}`,
                                margin: 0
                            }}>
                                {output || 'Belum ada output. Klik "Jalankan" untuk melihat hasil.'}
                            </pre>
                        </div>
                    </div>

                    <div style={{
                        background: currentTheme.surface,
                        borderRadius: '20px',
                        padding: '1rem',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
                        border: `1px solid ${currentTheme.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            fontWeight: '500',
                            marginBottom: '0.75rem',
                            color: currentTheme.text,
                            alignSelf: 'flex-start'
                        }}>
                            Canvas:
                        </div>
                        <div style={{
                            position: 'relative',
                            width: '400px',
                            height: '400px'
                        }}>
                            {/* Canvas untuk turtle */}
                            <div
                                id="mycanvas"
                                style={{
                                    width: '400px',
                                    height: '400px',
                                    background: theme === 'light' ? '#ffffff' : '#1a1a2e',
                                    borderRadius: '0px',
                                    border: `2px solid ${currentTheme.canvasBorder}`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    zIndex: 1
                                }}
                            />
                            {/* Grid overlay - selalu di atas canvas */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '400px',
                                height: '400px',
                                pointerEvents: 'none',
                                zIndex: 2
                            }}>
                                <CanvasGrid theme={theme} />
                            </div>
                        </div>
                    </div>
                </div>
            </Container>

            <Modal show={showSaveModal} onHide={() => setShowSaveModal(false)} centered>
                <Modal.Header closeButton style={{
                    backgroundColor: currentTheme.surface,
                    borderBottom: `1px solid ${currentTheme.border}`,
                    color: currentTheme.text
                }}>
                    <Modal.Title>Simpan Kode Python</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: currentTheme.surface, color: currentTheme.text }}>
                    <Form.Group>
                        <Form.Label>Nama file (tanpa .py)</Form.Label>
                        <Form.Control
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            placeholder="my_script"
                            style={{
                                backgroundColor: currentTheme.outputBg,
                                border: `1px solid ${currentTheme.border}`,
                                color: currentTheme.text
                            }}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer style={{
                    backgroundColor: currentTheme.surface,
                    borderTop: `1px solid ${currentTheme.border}`
                }}>
                    <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
                        Batal
                    </Button>
                    <Button variant="primary" onClick={() => {
                        handleSaveFile();
                        setShowSaveModal(false);
                    }}>
                        <BsDownload style={{ marginRight: '6px' }} /> Simpan
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

const CanvasGrid = ({ theme }) => {
    const gridColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    const centerColor = theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
    const textColor = theme === 'light' ? '#666' : '#999';
    
    return (
        <svg
            width="400"
            height="400"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none'
            }}
        >
            {/* Grid lines setiap 50px */}
            {Array.from({ length: 9 }, (_, i) => {
                const pos = i * 50;
                return (
                    <g key={i}>
                        {/* Vertical lines */}
                        <line
                            x1={pos}
                            y1={0}
                            x2={pos}
                            y2={400}
                            stroke={pos === 200 ? centerColor : gridColor}
                            strokeWidth={pos === 200 ? 2 : 1}
                        />
                        {/* Horizontal lines */}
                        <line
                            x1={0}
                            y1={pos}
                            x2={400}
                            y2={pos}
                            stroke={pos === 200 ? centerColor : gridColor}
                            strokeWidth={pos === 200 ? 2 : 1}
                        />
                    </g>
                );
            })}
            
            {/* Label sumbu X (di bawah, sejajar dengan garis tengah horizontal) */}
            <text
                x={380}
                y={210}
                fontSize="14"
                fontWeight="bold"
                fill={textColor}
                textAnchor="end"
                style={{ pointerEvents: 'none' }}
            >
                X →
            </text>
            
            {/* Label sumbu Y (di kiri, sejajar dengan garis tengah vertikal) */}
            <text
                x={190}
                y={14}
                fontSize="14"
                fontWeight="bold"
                fill={textColor}
                textAnchor="end"
                style={{ pointerEvents: 'none' }}
            >
                ↑ Y
            </text>
            
            {/* Label angka pada sumbu X (bawah) */}
            {Array.from({ length: 9 }, (_, i) => {
                const pos = i * 50;
                const value = pos - 200;
                if (value !== 0) {
                    return (
                        <text
                            key={`x-${i}`}
                            x={pos}
                            y={395}
                            fontSize="10"
                            fill={textColor}
                            textAnchor="middle"
                            style={{ pointerEvents: 'none' }}
                        >
                            {value}
                        </text>
                    );
                }
                return null;
            })}
            
            {/* Label angka pada sumbu Y (kiri) */}
            {Array.from({ length: 9 }, (_, i) => {
                const pos = i * 50;
                const value = 200 - pos;
                if (value !== 0) {
                    return (
                        <text
                            key={`y-${i}`}
                            x={5}
                            y={pos + 4}
                            fontSize="10"
                            fill={textColor}
                            textAnchor="start"
                            style={{ pointerEvents: 'none' }}
                        >
                            {value}
                        </text>
                    );
                }
                return null;
            })}
            
            {/* Label 0 di tengah */}
            <text
                x={200}
                y={395}
                fontSize="10"
                fill={textColor}
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
            >
                0
            </text>
            <text
                x={5}
                y={204}
                fontSize="10"
                fill={textColor}
                textAnchor="start"
                style={{ pointerEvents: 'none' }}
            >
                0
            </text>
        </svg>
    );
};

const ActionButton = ({ onClick, icon, label, variant, disabled }) => {
    const getStyles = () => {
        if (variant === 'primary') {
            return {
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                boxShadow: '0 2px 6px rgba(79,70,229,0.3)'
            };
        } else if (variant === 'secondary') {
            return {
                background: '#6c757d',
                color: 'white',
                border: 'none'
            };
        } else {
            return {
                background: 'transparent',
                color: '#4f46e5',
                border: '1px solid #4f46e5'
            };
        }
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '40px',
                fontWeight: '500',
                fontSize: '0.9rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: disabled ? 0.6 : 1,
                ...getStyles()
            }}
            onMouseEnter={(e) => {
                if (!disabled && variant !== 'outline') {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)';
                } else if (!disabled && variant === 'outline') {
                    e.currentTarget.style.background = '#4f46e5';
                    e.currentTarget.style.color = 'white';
                }
            }}
            onMouseLeave={(e) => {
                if (variant !== 'outline') {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                } else {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#4f46e5';
                }
            }}
        >
            {icon} {label}
        </button>
    );
};

export default App;