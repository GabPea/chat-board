from UDPChatServer import UDPChatServer

def main():
    server = UDPChatServer()

    try:
        server.start()
    except Exception as e:
        print("Errore", e)
    finally:
        server.stop()

if __name__ == "__main__":
    main()
