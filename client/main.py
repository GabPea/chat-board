from UDPChatClient import UDPChatClient

def main():
    print("Inserire l'indirizzo IP del server: ", end="")
    ip_address = input()
    client = UDPChatClient(ip_address)
    
    try:
        client.join()

        while True:
            print("> ", end="")
            message = input().strip()
            client.send_message(message)
    except Exception as e:
        print("Errore", e)
    finally:
        client.leave()

if __name__ == "__main__":
    main()
